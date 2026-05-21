# MuuAgent 服务

基于 NestJS 的企业级 AI 中台服务，提供统一的 AI 模型管理、智能调度、技能系统、智能体对话等功能。

## ✨ 功能特性

### 核心功能

- **模型管理**: 支持多厂商 AI 模型的统一管理（OpenAI、Ollama、Azure、阿里云、腾讯云等）
- **智能调度**: 权重/轮询/随机/故障转移策略，自动负载均衡
- **限流熔断**: 请求限流、熔断保护、自动降级，保障服务稳定性
- **技能系统**: HTTP/函数/数据库类型技能，可被智能体动态调用
- **智能体**: 基于 LLM 的智能对话，自动决策调用技能，支持多轮对话
- **统一 API**: 跨语言统一调用接口，支持流式输出（SSE）
- **用户透传**: 支持多租户场景，用户标识透传与隔离

### 管理功能

- **管理后台**: Vue3 + Element Plus 单页面管理面板
- **日志系统**: 完整的调用日志记录与查询
- **监控统计**: 实时统计与性能监控
- **权限控制**: API Key 鉴权机制

## 🚀 快速开始

### 环境要求

- Node.js 18+
- MySQL 8.0+ 或 SQLite 3
- Redis 6.0+（可选，用于限流和缓存）

### 安装依赖

```bash
cd service
npm install
```

### 配置环境

复制环境配置文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置（SQLite 开发环境）
DATABASE_URL="file:./dev.db"

# 或 MySQL 生产环境
# DATABASE_URL="mysql://user:password@localhost:3306/muu_ai_platform"

# 服务端口
PORT=3002

# API鉴权密钥
API_KEY="AI-SVC-2026-MCP-KEY-666"

# JWT密钥
JWT_SECRET="your-jwt-secret-key"

# Redis配置（可选）
REDIS_URL="redis://localhost:6379"

# 日志级别
LOG_LEVEL="info"
```

> 💡 详细的环境变量配置说明请查看 [ENV.md](./ENV.md)

### 初始化数据库

```bash
# 开发环境推荐：使用 db push（快速同步，不生成迁移文件）
npm run db:sync

# 生产环境：使用迁移（可追溯的数据库变更）
npm run db:migrate:prod
```

> 💡 **开发模式说明**
> - `npm run db:sync`：直接同步 schema 到数据库，适合开发阶段快速迭代
> - `npm run db:migrate`：创建迁移文件并应用，适合团队协作和生产环境

### 启动服务

```bash
# 开发模式
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

服务启动后访问：
- API 服务: http://localhost:3002
- API 文档: http://localhost:3002/api-docs
- 管理后台: http://localhost:3002/admin.html

## 📚 API 接口

### 模型管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/model` | 创建模型 |
| GET | `/api/model` | 模型列表 |
| GET | `/api/model/:id` | 模型详情 |
| PUT | `/api/model/:id` | 更新模型 |
| DELETE | `/api/model/:id` | 删除模型 |
| GET | `/api/model/:id/health` | 健康检查 |

### AI 调用

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/invoke` | 普通调用 |
| POST | `/api/ai/stream` | 流式调用（SSE） |
| POST | `/api/ai/embedding` | 向量生成 |
| POST | `/api/ai/image` | 文生图 |

### 智能体

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agent` | 创建智能体 |
| GET | `/api/agent` | 智能体列表 |
| GET | `/api/agent/:id` | 智能体详情 |
| PUT | `/api/agent/:id` | 更新智能体 |
| DELETE | `/api/agent/:id` | 删除智能体 |
| POST | `/api/agent/chat` | 智能体对话 |

### 技能管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/skill` | 创建技能 |
| GET | `/api/skill` | 技能列表 |
| GET | `/api/skill/:id` | 技能详情 |
| PUT | `/api/skill/:id` | 更新技能 |
| DELETE | `/api/skill/:id` | 删除技能 |
| POST | `/api/skill/execute` | 执行技能 |

### MCP 调度

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mcp/strategy/:modelType` | 获取调度策略 |
| PUT | `/api/mcp/strategy/:modelType` | 更新调度策略 |
| GET | `/api/mcp/status` | 获取模型状态 |
| POST | `/api/mcp/circuit/reset/:modelId` | 重置熔断 |

### 限流配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/rate-limit/rules` | 获取限流规则 |
| POST | `/api/rate-limit/rules` | 创建限流规则 |
| PUT | `/api/rate-limit/rules/:id` | 更新限流规则 |
| DELETE | `/api/rate-limit/rules/:id` | 删除限流规则 |

### 熔断配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mcp/circuit/rules` | 获取熔断规则 |
| POST | `/api/mcp/circuit/rules` | 创建熔断规则 |
| PUT | `/api/mcp/circuit/rules/:modelId` | 更新熔断规则 |
| DELETE | `/api/mcp/circuit/rules/:modelId` | 删除熔断规则 |

### 日志查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/log/ai` | AI 调用日志 |
| GET | `/api/log/ai/:id` | AI 调用日志详情 |
| GET | `/api/log/skill` | 技能调用日志 |
| GET | `/api/log/agent` | Agent 调用日志 |
| GET | `/api/log/statistics` | 调用统计 |

## 🔐 鉴权说明

### API Key 鉴权

所有 API 请求需要在请求头中携带 API 密钥：

```http
Authorization: Bearer AI-SVC-2026-MCP-KEY-666
```

或使用自定义请求头：

```http
x-api-key: AI-SVC-2026-MCP-KEY-666
```

### 用户透传

支持多租户场景，可通过两种方式传递用户标识：

**方式一：请求头**

```http
x-uid: user-12345
```

**方式二：请求体**

```json
{
  "uid": "user-12345",
  "messages": [...]
}
```

详细说明请查看 [用户透传文档](../docs/user-pass-through.md)。

## 🐳 Docker 部署

### 快速部署

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境部署

详细的生产环境部署说明请查看：

- [快速部署指南](../docs/quick-start.md)
- [完整部署文档](../docs/production-deployment.md)

### Docker Compose 配置

项目包含完整的 Docker Compose 配置：

- MySQL 8.0 数据库
- Redis 7 缓存
- AI 中台应用服务
- Nginx 反向代理（可选）

## 📁 项目结构

```
MuuAgent/
├── admin/                  # 管理后台（Vue3）
│   ├── src/
│   │   ├── api/           # API 接口
│   │   ├── views/         # 页面组件
│   │   └── components/    # 通用组件
│   └── package.json
├── service/               # 后端服务（NestJS）
│   ├── prisma/           # 数据库 Schema
│   ├── public/           # 静态文件
│   ├── src/
│   │   ├── ai/           # AI 调用模块
│   │   ├── agent/        # 智能体模块
│   │   ├── common/       # 公共模块
│   │   ├── log/          # 日志模块
│   │   ├── mcp/          # MCP 调度模块
│   │   ├── model/        # 模型管理模块
│   │   ├── rate-limit/   # 限流模块
│   │   └── skill/        # 技能模块
│   ├── .env.production   # 生产环境配置
│   └── package.json
├── deploy/               # 部署配置
│   ├── mysql/           # MySQL 配置
│   ├── nginx/           # Nginx 配置
│   └── scripts/         # 部署脚本
├── docs/                # 文档
│   ├── user-pass-through.md      # 用户透传文档
│   ├── production-deployment.md  # 生产部署文档
│   └── quick-start.md            # 快速开始
├── docker-compose.yml   # Docker 编排
├── Dockerfile          # 应用镜像
└── README.md           # 项目说明
```

## ⚙️ 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| DATABASE_URL | 数据库连接字符串 | - | 是 |
| PORT | 服务端口 | 3002 | 否 |
| API_KEY | API 鉴权密钥 | - | 是 |
| JWT_SECRET | JWT 签名密钥 | - | 是 |
| REDIS_URL | Redis 连接字符串 | - | 否 |
| LOG_LEVEL | 日志级别 | info | 否 |
| NODE_ENV | 运行环境 | development | 否 |

### 数据库配置

#### SQLite（开发环境）

```env
DATABASE_URL="file:./dev.db"
```

#### MySQL（生产环境）

```env
DATABASE_URL="mysql://user:password@localhost:3306/muu_ai_platform?connection_limit=10&pool_timeout=30"
```

### 限流配置

```env
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### 熔断配置

```env
CIRCUIT_BREAKER_TIMEOUT=60000
CIRCUIT_BREAKER_ERROR_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=3
```

## 📖 使用示例

### AI 调用示例

```bash
# 普通调用
curl -X POST http://localhost:3002/api/ai/invoke \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AI-SVC-2026-MCP-KEY-666" \
  -H "x-uid: user-123" \
  -d '{
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'

# 流式调用
curl -X POST http://localhost:3002/api/ai/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AI-SVC-2026-MCP-KEY-666" \
  -d '{
    "messages": [
      {"role": "user", "content": "写一首诗"}
    ]
  }'
```

### 智能体对话示例

```bash
curl -X POST http://localhost:3002/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer AI-SVC-2026-MCP-KEY-666" \
  -H "x-uid: user-123" \
  -d '{
    "agentId": "agent-001",
    "message": "帮我查询今天的天气"
  }'
```

### JavaScript 调用示例

```javascript
// 使用 fetch API
async function callAI(message, uid) {
  const response = await fetch('http://localhost:3002/api/ai/invoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer AI-SVC-2026-MCP-KEY-666',
      'x-uid': uid,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }]
    }),
  });
  
  return response.json();
}
```

## 🔧 开发指南

### 数据库开发

```bash
# 开发环境：快速同步 schema 到数据库（推荐）
npm run db:sync

# 生成 Prisma Client
npm run db:generate

# 打开数据库可视化工具
npm run db:studio

# 生产环境：创建迁移文件
npm run db:migrate -- --name migration_name

# 生产环境：应用迁移
npm run db:migrate:prod
```

> ⚠️ **注意事项**
> - 开发阶段使用 `db:sync`，不会生成迁移文件，也不会清空数据
> - 生产部署前，请使用 `db:migrate` 创建迁移文件
> - 修改 schema 后，记得运行 `db:generate` 更新 Prisma Client

### 代码规范

项目遵循以下规范：

- 所有常量、变量、函数、类都必须注释
- 所有函数都必须有参数注释
- 所有函数都必须有返回值注释
- 使用 TypeScript 严格模式

### 运行测试

```bash
# 单元测试
npm run test

# e2e 测试
npm run test:e2e

# 测试覆盖率
npm run test:cov
```

## 📊 监控与日志

### 日志查询

```bash
# AI 调用日志
curl http://localhost:3002/api/log/ai?uid=user-123

# 调用统计
curl http://localhost:3002/api/log/statistics
```

### 健康检查

```bash
# 应用健康检查
curl http://localhost:3002/health
```

## 🛡️ 安全建议

1. **修改默认密钥**: 生产环境务必修改 API_KEY 和 JWT_SECRET
2. **使用 HTTPS**: 配置 SSL 证书，启用 HTTPS
3. **数据库安全**: 使用强密码，限制数据库用户权限
4. **定期备份**: 设置自动备份任务
5. **防火墙配置**: 只开放必要端口

## 📝 更新日志

### v1.0.0 (2026-05-05)

- ✨ 新增用户透传功能，支持多租户场景
- ✨ 新增限流配置管理接口
- ✨ 新增熔断配置管理接口
- ✨ 新增日志查询支持按 uid 筛选
- 🐛 修复 SSE 数据解析问题
- 🐛 修复 Token 统计为 0 的问题
- 🐛 修复熔断状态数据为空的问题
- 📝 完善生产环境部署文档
- 🐳 添加 Docker 部署支持

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request。

## 📄 许可证

MIT License

## 📞 联系方式

如有问题或建议，请提交 Issue。
