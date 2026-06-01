# MuuAgent-Middle-Platform-Framework

## 定位：轻量化、易集成、可快速搭建各类 AI Agent 的通用框架

 - 不念过往耕耘，不负时代趋势
 - 不颠覆存量业务，用 MuuAgent 激活系统新生
 - 一套完整、轻量、易拓展的 Agent 搭建底座。既可无缝对接存量业务系统，低成本完成智能化升级；也可独立赋能各类场景，快速定制开发专属自主智能体。

## 🎯 项目简介

MuuAgent 是一个基于 NestJS 和 Vue 3 构建的企业级中台服务，包含管理后台（admin）和用户端对话界面（client），旨在为企业提供统一的 AI 能力接入和管理平台。

### 核心价值

- **统一接入**: 一套 API 接入多家模型厂商（OpenAI、Azure、阿里云、腾讯云、火山引擎、Deepseek、智谱AI、Ollama 等）
- **智能调度**: 自动负载均衡、故障转移、限流熔断、模型权重调度、意图分类路由
- **成本优化**: 模型权重调度，智能选择最优模型，意图分类自动路由
- **快速集成**: 标准化 API，支持多语言调用
- **模板化管理**: 提示词模板、模型参数模板标准化管理
- **多租户隔离**: 应用级资源隔离，独立 API Key 与配额管理
- **智能推理**: 支持 ReAct、Plan、Reflect 等多种推理模式

### ⚠️ 重要说明

当前项目中的 `client` 目录仅为调试使用，你需要根据你的业务场景自建 client 端。

## ✨ 功能特性

### 🏢 应用管理

- 多租户应用创建与管理
- 独立 API Key 与密钥管理
- QPS / 日调用量 / Token 配额限制
- OAuth 2.0 客户端管理
- 应用级资源隔离（智能体、技能、知识库）

### 🤖 模型管理

- 支持多厂商 AI 模型统一管理
- 模型类型支持：LLM、Embedding、TTS、ASR、Image、LMM、S2S
- 模型权重配置与负载均衡
- 模型健康检查与自动监控
- 模型标签与分类管理

### 📋 模型参数模板

- 标准化参数配置管理
- 温度参数（Temperature）、核采样（TopP）配置
- 上下文窗口（Context Window）、最大生成长度（Max Tokens）配置
- 场景标签管理（客服问答、创意文案、代码生成等）
- 默认模板设置

### 📝 提示词模板

- 提示词模板化管理
- 模板分类（智能体、RAG、ReAct、技能、自定义）
- 变量系统支持（变量定义、验证、默认值）
- Handlebars 模板语法
- 版本控制与回滚

### 🤝 智能体

- 基于 LLM 的智能对话
- 多种推理模式（ReAct、Plan、Reflect、None）
- 自动决策调用技能
- 知识库检索集成
- MCP Server 集成
- 自定义推理提示词
- 工作目录文件操作支持
- 推理步骤可视化展示

### 🛠️ 技能系统

- **HTTP 技能**: 调用外部 API
- **函数技能**: 内置函数 / 插件函数 / 沙箱代码执行
- **MCP 技能**: 调用 MCP Server 提供的工具
- **标准技能**: Markdown 格式技能包，支持文件/数据库技能提供者
- **数据库技能**: 内置 SQL 查询与连接池管理
- 技能测试与调试
- AI 智能技能选择

### 🔊 TTS 语音合成

- 多厂商 TTS 语音合成
- WebSocket 实时语音流推送
- 语音配置管理（Voice Profile）
- 会话级语音参数控制

### 🌐 浏览器工具

- Browser MCP 工具集成
- 网页浏览与信息提取
- 智能体可调用浏览器操作

### 🖥️ 客户端工具

- 动态客户端工具（SSE 下发）
- 客户端工具注册与发现
- 工具策略管理
- 工具执行结果回调

### 📚 知识库管理

- 知识库创建与管理
- 文档上传与解析（支持多种格式）
- 向量化存储（Qdrant）
- BM25 检索支持
- 混合检索策略
- RAG 问答集成

### 🔌 MCP Server

- Model Context Protocol 支持
- MCP Server 配置管理
- 动态工具发现与调用

### 🔄 模型智能调度

- 多种调度策略：权重、轮询、随机、故障转移
- 自动负载均衡
- 模型状态监控
- 熔断降级机制

### 🎯 意图分类

- 关键词快速匹配 + AI 兜底混合策略
- 意图关键词管理
- 意图缓存机制
- 意图路由日志
- 意图分类仪表盘
- 自动路由到最优模型类型

### 📁 工作目录

- 智能体工作目录文件管理
- 文件上传、下载、删除
- 文件列表查看
- 与技能系统联动

### 🛡️ 限流熔断

- 多级别限流（全局 / 应用 / 接口 / 模型）
- 令牌桶算法
- 熔断降级与自动恢复
- 黑名单管理

### � 会话管理

- 会话创建、编辑、删除
- 按类型筛选（智能体对话、模型对话、知识库对话）
- 会话状态管理
- 对话消息记录查看

### 🔐 OAuth 认证

- OAuth 2.0 客户端凭证模式
- 多客户端管理
- 客户端凭证 + 刷新令牌
- Token 生命周期管理

### � 管理员认证

- JWT Token 认证
- 刷新令牌机制
- 角色权限控制（admin / ops / read）
- 超级管理员

### 📊 监控日志

- AI 模型调用日志
- 智能体对话日志
- 技能调用日志
- 知识库检索日志
- 应用使用量统计

### 🖥️ 用户端对话

- 流式对话交互
- 智能体 / 模型 / 知识库三种对话模式
- Markdown 渲染与代码高亮
- 推理过程可视化
- 会话历史管理

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│              管理后台 (admin)         用户端 (client)      │
│            Vue 3 + Element Plus + TypeScript             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   API 网关 (Nginx)                       │
│              负载均衡 + SSL + WebSocket + 限流            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                 AI 中台服务 (NestJS)                     │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ 应用管理  │ 模型管理  │ 参数模板  │ 提示词模板 │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ 智能体    │ 技能系统  │ 知识库    │ 会话管理  │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ MCP Server│ MCP调度  │ 限流熔断  │ OAuth认证 │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ 意图分类  │ 工作目录  │ 推理引擎  │ 日志系统  │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ TTS 语音  │ 浏览器工具│ 客户端工具│ 语音配置  │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┐                    │
│  │ 文件管理  │ 向量检索  │ 模块发现  │                    │
│  └──────────┴──────────┴──────────┘                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    数据层                                │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │  MySQL   │  Redis   │  Prisma  │  Qdrant  │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- MySQL 8.0+
- Redis 6.0+（可选，用于缓存和限流）
- Qdrant（可选，用于向量检索）
- Docker & Docker Compose 20.10+（推荐）

### Docker 一键部署（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd MuuAgent

# 2. 配置环境变量
cp service/.env.example service/.env
# 编辑 service/.env 修改密钥等配置（务必修改 JWT_SECRET、MYSQL_PASSWORD）

# 3. 构建并启动所有服务
docker-compose build
docker-compose up -d

# 4. 初始化管理员账号（数据库迁移由 entrypoint 自动执行）
docker-compose exec app npx ts-node prisma/init-admin.ts

# 5. 访问服务
# 管理后台: http://localhost:3002/admin/
# 用户端:   http://localhost:3002/client/
# API 文档: http://localhost:3002/api-docs
```

> **说明**: 容器启动时会通过 `entrypoint.sh` 自动执行 `prisma migrate deploy`，无需手动运行数据库迁移。如需 SSL/HTTPS，请先运行 `bash deploy/scripts/generate-ssl.sh` 生成自签名证书。
>
> 更多 Docker 部署详情请查看 [快速部署指南](docs/quick-start.md) 和 [完整部署文档](docs/production-deployment.md)。

### 本地开发

```bash
# 后端服务
cd service
npm install
npm run db:sync      # 同步数据库 schema
npm run db:generate  # 生成 Prisma Client
npm run start:dev    # 启动开发服务器

# 管理后台
cd admin
npm install
npm run dev          # 启动开发服务器

# 用户端
cd client
npm install
npm run dev          # 启动开发服务器
```

详细部署说明请查看：

- [快速部署指南](docs/quick-start.md)
- [完整部署文档](docs/production-deployment.md)

## 📁 项目结构

```
MuuAgent/
├── admin/                  # 管理后台（Vue 3）
│   ├── src/
│   │   ├── api/           # API 接口层
│   │   ├── views/         # 页面组件
│   │   │   ├── dashboard/          # 仪表盘
│   │   │   ├── apps/              # 应用管理
│   │   │   ├── models/            # 模型配置
│   │   │   │   ├── ModelList.vue          # 模型列表
│   │   │   │   ├── TemplateList.vue       # 参数模板列表
│   │   │   │   ├── IntentCache.vue        # 意图缓存
│   │   │   │   ├── IntentKeyword.vue      # 意图关键词
│   │   │   │   ├── IntentDashboard.vue    # 意图仪表盘
│   │   │   │   ├── RoutingLog.vue         # 路由日志
│   │   │   │   └── StrategyConfig.vue     # 策略配置
│   │   │   ├── mcp-server/       # MCP Server 管理
│   │   │   ├── skills/            # 技能管理
│   │   │   ├── agents/            # 智能体管理
│   │   │   ├── kb/                # 知识库管理
│   │   │   ├── prompt-templates/  # 提示词模板
│   │   │   ├── rate-limit/        # 熔断限流
│   │   │   ├── conversations/     # 会话管理
│   │   │   ├── logs/              # 调用日志
│   │   │   └── login/             # 登录页
│   │   ├── layouts/       # 布局组件
│   │   ├── stores/        # 状态管理（Pinia）
│   │   ├── router/        # 路由配置
│   │   └── styles/        # 全局样式
│   └── package.json
├── client/                 # 用户端对话界面（Vue 3）
│   ├── src/
│   │   ├── api/           # API 接口层
│   │   ├── views/         # 页面组件
│   │   │   └── chat/      # 对话页面
│   │   ├── composables/   # 组合式函数
│   │   ├── stores/        # 状态管理（Pinia）
│   │   └── styles/        # 全局样式
│   └── package.json
├── cli/                   # 命令行工具（Node.js）
│   ├── src/
│   │   ├── commands/      # 命令实现
│   │   └── utils/         # 工具函数
│   └── package.json
├── desktop/               # 桌面端应用（Electron）
│   ├── src/
│   │   ├── electron/      # Electron 主进程
│   │   │   ├── desktop-mcp/   # 桌面 MCP 工具
│   │   │   └── sse/           # SSE 通信
│   │   └── ...
│   └── package.json
├── service/               # 后端服务（NestJS）
│   ├── prisma/           # 数据库 Schema 与迁移
│   ├── src/              # 源代码
│   │   ├── admin/        # 管理员认证模块
│   │   ├── agent/        # 智能体模块（ReAct 推理）
│   │   │   ├── execution/  # 执行上下文与提示词构建
│   │   │   └── tools/      # 内置工具（HTTP/DB/KB/代码执行）
│   │   ├── ai/           # AI 调用模块（多厂商适配）
│   │   │   ├── strategies/ # 多厂商策略（OpenAI/Azure/阿里云/Deepseek/Ollama/智谱/火山引擎）
│   │   │   └── tts/        # TTS 语音合成
│   │   ├── app/          # 应用管理模块
│   │   ├── auth/         # 认证模块
│   │   ├── browser/      # 浏览器工具模块
│   │   ├── cache/        # 缓存模块
│   │   ├── client-tool/  # 客户端工具模块
│   │   │   └── dynamic/    # 动态客户端工具（SSE 下发）
│   │   ├── common/       # 公共模块（守卫、过滤器、工具）
│   │   ├── conversation/ # 会话管理模块
│   │   ├── desktop/      # 桌面端工具模块
│   │   ├── document/     # 文档管理模块
│   │   ├── file/         # 文件管理模块
│   │   ├── intent/       # 意图分类模块
│   │   ├── kb/           # 知识库模块
│   │   ├── log/          # 日志模块
│   │   ├── mcp/          # MCP 调度模块
│   │   ├── mcp-server/   # MCP Server 模块
│   │   ├── model/        # 模型管理模块
│   │   ├── model-template/  # 模型参数模板
│   │   ├── model-routing/   # 模型路由调度
│   │   ├── module-discovery/ # 模块自动发现
│   │   ├── oauth/        # OAuth 认证模块
│   │   ├── prompt-template/ # 提示词模板
│   │   ├── rate-limit/   # 限流熔断模块
│   │   ├── reasoning/    # 推理引擎模块
│   │   ├── retrieval/    # 检索模块（向量 + BM25）
│   │   ├── skill/        # 技能模块
│   │   ├── stream/       # SSE 流式响应模块
│   │   ├── task/         # 任务队列模块
│   │   ├── vector/       # 向量存储模块
│   │   ├── voice-profile/ # 语音配置模块
│   │   └── workspace/    # 工作目录模块
│   └── package.json
├── deploy/               # 部署配置
│   ├── mysql/           # MySQL 配置
│   ├── nginx/           # Nginx 配置
│   └── scripts/         # 部署脚本
├── docs/                # 文档
│   ├── quick-start.md            # 快速开始
│   ├── production-deployment.md  # 生产部署
│   ├── panel-deployment.md       # 面板部署
│   ├── prompt-template-guide.md  # 提示词模板指南
│   ├── model-management-guide.md # 模型管理指南
│   ├── agent-guide.md            # 智能体指南
│   ├── builtin-tool-registration-guide.md # 内置工具注册指南
│   ├── custom_tool-guide.md      # 自定义工具指南
│   ├── knowledge-base-retrieval.md # 知识库检索
│   ├── qdrant-configuration.md   # Qdrant 配置
│   ├── smart-routing.md          # 智能路由
│   ├── agent-model-routing.md    # 智能体模型路由
│   ├── oauth-token-guide.md      # OAuth 令牌管理
│   ├── user-pass-through.md      # 用户透传
│   └── admin-authentication.md   # 管理员认证
├── docker-compose.yml   # Docker 编排
├── Dockerfile          # 应用镜像
├── scripts/            # 工具脚本
│   └── sync-version.js # 版本号同步脚本
├── VERSION             # 统一版本号文件
├── LICENSE             # Apache 2.0 许可证
├── package.json        # 根项目配置
└── README.md           # 项目说明
```

## 📚 文档

### 快速入门

- [快速部署指南](docs/quick-start.md) - 5 分钟快速部署
- [面板部署指南](docs/panel-deployment.md) - 宝塔面板和 1Panel 部署
- [生产部署文档](docs/production-deployment.md) - 完整的生产环境部署指南

### 核心功能

- [模型管理指南](docs/model-management-guide.md) - 模型配置与参数模板管理
- [提示词模板指南](docs/prompt-template-guide.md) - 提示词模板的创建与使用
- [智能体指南](docs/agent-guide.md) - 智能体配置与推理模式
- [内置工具注册指南](docs/builtin-tool-registration-guide.md) - 内置工具的注册与使用
- [自定义工具指南](docs/custom_tool-guide.md) - 自定义工具的开发与集成
- [知识库检索文档](docs/knowledge-base-retrieval.md) - 知识库管理与 RAG 检索

### 高级功能

- [智能路由文档](docs/smart-routing.md) - 模型调度与负载均衡
- [智能体模型路由文档](docs/agent-model-routing.md) - 智能体模型路由策略
- [用户透传文档](docs/user-pass-through.md) - 多租户用户透传功能
- [管理员认证文档](docs/admin-authentication.md) - 管理员认证与权限
- [OAuth Token 文档](docs/oauth-token-guide.md) - OAuth 2.0 令牌管理

### 技术文档

- [Qdrant 配置文档](docs/qdrant-configuration.md) - 向量数据库配置
- [服务 README](service/README.md) - 后端服务详细说明

## 🔧 开发指南

### 后端开发

```bash
cd service
npm install
npm run start:dev
```

### 管理后台开发

```bash
cd admin
npm install
npm run dev
```

### 用户端开发

```bash
cd client
npm install
npm run dev
```

### 数据库操作

```bash
cd service

# 同步 Schema 到数据库（开发环境）
npm run db:sync

# 生成 Prisma Client
npm run db:generate

# 创建迁移文件（生产环境）
npm run db:migrate -- --name migration_name

# 应用迁移
npm run db:migrate:prod

# 打开数据库可视化工具
npm run db:studio
```

### 初始化数据

```bash
cd service

# 初始化管理员账号
npm run init:admin

# 初始化提示词模板
npx ts-node prisma/init-templates.ts
```

### 版本管理

项目使用统一的版本号管理，所有子项目（service、admin、client）共享同一个版本号。

**版本号文件**: `VERSION`

**常用命令**:

```bash
# 同步版本号到所有子项目
npm run sync-version

# 升级补丁版本 (1.3.0 -> 1.3.1)
npm run version:patch

# 升级次版本 (1.3.0 -> 1.4.0)
npm run version:minor

# 升级主版本 (1.3.0 -> 2.0.0)
npm run version:major
```

**版本号规则**:
- 主版本号（Major）: 不兼容的 API 修改
- 次版本号（Minor）: 向下兼容的功能性新增
- 修订号（Patch）: 向下兼容的问题修正

## 🌐 API 文档

启动服务后访问：

- Swagger 文档: <http://localhost:3002/api-docs>
- ReDoc 文档: <http://localhost:3002/api-docs-json>

## 📊 性能特性

- **高并发**: 单节点万级长连接，集群水平扩展支持数十万级并发
- **流式响应**: SSE / WebSocket 流式输出，首 Token 延迟 < 500ms
- **高可用**: 99.9% 服务可用性，多模型故障自动转移
- **弹性伸缩**: 无状态设计，支持 Kubernetes 水平自动扩缩容
- **智能调度**: 权重 / 轮询 / 随机 / 故障转移多策略负载均衡
- **故障转移**: 模型级健康检查 + 熔断降级，秒级切换备用模型
- **意图分类**: 毫秒级关键词匹配 + AI 兜底，准确率 > 95%
- **缓存优化**: 意图缓存、模型配置缓存、会话缓存多级缓存策略
- **连接池管理**: 数据库连接池 + HTTP 连接复用，减少资源开销

## 🛡️ 安全特性

- API Key 鉴权
- JWT Token 认证
- OAuth 2.0 认证
- 请求限流保护
- 熔断降级机制
- SQL 注入防护
- XSS 攻击防护
- HTTPS 加密传输
- 细粒度权限控制

## 🎯 使用场景

### 智能客服

- 多轮对话支持
- 知识库问答
- 技能调用（查询订单、物流等）
- 情感分析与智能路由
- 意图识别自动分配最优模型

### 内容创作

- 创意文案生成
- 文章写作辅助
- 多模态内容生成
- 风格迁移与改写
- 意图分类自动选择创作模型

### 代码开发

- 代码生成与补全
- 代码审查与优化
- 技术文档生成
- Bug 分析与修复建议
- 自动路由到代码专用模型

### 企业知识管理

- 知识库构建
- 智能检索
- 知识问答
- 文档摘要
- 意图分类优化检索策略

### 数据分析

- 数据查询与分析
- 报告生成
- 可视化建议
- 趋势预测
- 自动选择分析型模型

## 🤝 贡献指南

我们欢迎所有形式的贡献，包括但不限于：

- 提交 Issue 报告 Bug 或提出新功能建议
- 提交 Pull Request 改进代码
- 完善文档
- 分享使用经验

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

##  许可证


本项目采用 Apache 2.0 许可证 - 详见 [LICENSE](LICENSE) 文件

## 📞 联系方式

- 项目主页: [Muu官网](https://www.muucmf.cc)
- 问题反馈: [Issue Tracker](https://github.com/MuuCmf/MuuAgent-Middle-Platform-Framework/issues)
- 邮箱: <59262424@qq.com>

## 🙏 致谢

感谢以下开源项目：

### 后端框架与核心库

- [NestJS](https://nestjs.com/) - 后端框架
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [Swagger](https://swagger.io/) - API 文档
- [Bull](https://github.com/OptimalBits/bull) - 任务队列
- [Passport](https://www.passportjs.org/) - 认证中间件
- [Zod](https://zod.dev/) - 数据验证库
- [class-validator](https://github.com/typestack/class-validator) - 声明式验证
- [Sharp](https://sharp.pixelplumbing.com/) - 图像处理
- [Axios](https://axios-http.com/) - HTTP 客户端

### AI 与模型

- [Vercel AI SDK](https://sdk.vercel.ai/) - AI 模型调用 SDK
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) - MCP 协议 SDK
- [Qdrant](https://qdrant.tech/) - 向量数据库

### 前端框架与 UI

- [Vue 3](https://vuejs.org/) - 前端框架
- [Element Plus](https://element-plus.org/) - UI 组件库
- [Pinia](https://pinia.vuejs.org/) - 状态管理
- [Vue Router](https://router.vuejs.org/) - 路由管理
- [Vite](https://vitejs.dev/) - 构建工具
- [Vue I18n](https://vue-i18n.intlify.dev/) - 国际化方案
- [Shiki](https://shiki.style/) - 代码语法高亮
- [Mermaid](https://mermaid.js.org/) - 图表渲染

### 桌面端与 CLI

- [Electron](https://www.electronjs.org/) - 桌面应用框架
- [Commander](https://github.com/tj/commander.js) - CLI 命令框架
- [Inquirer](https://github.com/SBoudrias/Inquirer.js) - 交互式命令行
- [nut.js](https://nutjs.dev/) - 桌面自动化

***

**Made with ❤️ by MuuAgent Team**