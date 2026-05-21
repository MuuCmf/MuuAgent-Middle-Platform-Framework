# MuuAI-Middle-Platform

企业级 AI 中台服务，提供统一的 AI 模型管理、智能调度、技能系统、智能体、知识库管理、提示词模板、多租户应用管理、意图分类、工作目录等功能。

## 🎯 项目简介

MuuAI-Middle-Platform 是一个基于 NestJS 和 Vue 3 构建的企业级 AI 中台服务，包含管理后台（admin）和用户端对话界面（client），旨在为企业提供统一的 AI 能力接入和管理平台。

### 核心价值

- **统一接入**: 一套 API 接入多家 AI 厂商（OpenAI、Azure、阿里云、腾讯云、火山引擎、Deepseek、智谱AI、Ollama 等）
- **智能调度**: 自动负载均衡、故障转移、限流熔断、模型权重调度、意图分类路由
- **成本优化**: 模型权重调度，智能选择最优模型，意图分类自动路由
- **快速集成**: 标准化 API，支持多语言调用
- **模板化管理**: 提示词模板、模型参数模板标准化管理
- **多租户隔离**: 应用级资源隔离，独立 API Key 与配额管理
- **智能推理**: 支持 ReAct、Plan、Reflect 等多种推理模式

## ✨ 功能特性

### 🏢 应用管理

- 多租户应用创建与管理
- 独立 API Key 与密钥管理
- QPS / 日调用量 / Token 配额限制
- OAuth 2.0 客户端管理
- 应用级资源隔离（智能体、技能、知识库）

### 🤖 模型管理

- 支持多厂商 AI 模型统一管理
- 模型类型支持：LLM、Embedding、TTS、ASR、Image、Multimodal
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
- 技能测试与调试
- AI 智能技能选择

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

### 🔄 MCP 智能调度

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

- OAuth 2.0 认证支持
- 多客户端管理
- 授权码模式
- Token 管理

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
│              负载均衡 + SSL + 限流                        │
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
│  ┌──────────┬──────────┬──────────┐                    │
│  │ 文件管理  │ 向量检索  │ 任务队列  │                    │
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
- Docker & Docker Compose（推荐）

### Docker 一键部署

```bash
# 1. 克隆项目
git clone <repository-url>
cd MuuAI-Middle-Platform

# 2. 配置环境变量
cp service/.env.example service/.env
# 编辑 service/.env 修改密钥等配置

# 3. 启动服务
docker-compose up -d

# 4. 初始化数据
docker-compose exec app npm run init:admin
docker-compose exec app npm run db:sync

# 5. 访问服务
# 管理后台: http://localhost:9898/admin/
# 用户端:   http://localhost:9898/chat/
# API 文档: http://localhost:3002/api-docs
```

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
MuuAI-Middle-Platform/
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
├── service/               # 后端服务（NestJS）
│   ├── prisma/           # 数据库 Schema 与迁移
│   ├── src/              # 源代码
│   │   ├── admin/        # 管理员认证模块
│   │   ├── agent/        # 智能体模块（ReAct 推理）
│   │   ├── ai/           # AI 调用模块（多厂商适配）
│   │   ├── app/          # 应用管理模块
│   │   ├── auth/         # 认证模块
│   │   ├── cache/        # 缓存模块
│   │   ├── common/       # 公共模块（守卫、过滤器、工具）
│   │   ├── conversation/ # 会话管理模块
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
│   │   ├── oauth/        # OAuth 认证模块
│   │   ├── prompt-template/ # 提示词模板
│   │   ├── rate-limit/   # 限流熔断模块
│   │   ├── reasoning/    # 推理引擎模块
│   │   ├── retrieval/    # 检索模块（向量 + BM25）
│   │   ├── skill/        # 技能模块
│   │   ├── stream/       # SSE 流式响应模块
│   │   ├── task/         # 任务队列模块
│   │   ├── vector/       # 向量存储模块
│   │   └── workspace/    # 工作目录模块
│   └── package.json
├── deploy/               # 部署配置
│   ├── mysql/           # MySQL 配置
│   ├── nginx/           # Nginx 配置
│   └── scripts/         # 部署脚本
├── docs/                # 文档
│   ├── quick-start.md            # 快速开始
│   ├── production-deployment.md  # 生产部署
│   ├── prompt-template-guide.md  # 提示词模板指南
│   ├── model-management-guide.md # 模型管理指南
│   ├── agent-guide.md            # 智能体指南
│   ├── skill-configuration.md    # 技能配置
│   ├── knowledge-base-retrieval.md # 知识库检索
│   ├── qdrant-configuration.md   # Qdrant 配置
│   ├── smart-routing.md          # 智能路由
│   ├── user-pass-through.md      # 用户透传
│   └── admin-authentication.md   # 管理员认证
├── docker-compose.yml   # Docker 编排
├── Dockerfile          # 应用镜像
└── README.md           # 项目说明
```

## 📚 文档

### 快速入门

- [快速部署指南](docs/quick-start.md) - 5 分钟快速部署
- [生产部署文档](docs/production-deployment.md) - 完整的生产环境部署指南

### 核心功能

- [模型管理指南](docs/model-management-guide.md) - 模型配置与参数模板管理
- [提示词模板指南](docs/prompt-template-guide.md) - 提示词模板的创建与使用
- [智能体指南](docs/agent-guide.md) - 智能体配置与推理模式
- [技能配置文档](docs/skill-configuration.md) - 技能系统的配置与使用
- [知识库检索文档](docs/knowledge-base-retrieval.md) - 知识库管理与 RAG 检索

### 高级功能

- [智能路由文档](docs/smart-routing.md) - 模型调度与负载均衡
- [智能体模型路由文档](docs/agent-model-routing.md) - 智能体模型路由策略
- [用户透传文档](docs/user-pass-through.md) - 多租户用户透传功能
- [管理员认证文档](docs/admin-authentication.md) - 管理员认证与权限

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

## 🌐 API 文档

启动服务后访问：

- Swagger 文档: <http://localhost:3002/api-docs>
- ReDoc 文档: <http://localhost:3002/api-docs-json>

## 📊 性能特性

- **高并发**: 支持千级并发请求
- **低延迟**: 平均响应时间 < 100ms
- **高可用**: 99.9% 服务可用性
- **自动扩展**: 支持水平扩展
- **智能调度**: 基于权重的负载均衡
- **故障转移**: 自动切换备用模型
- **意图分类**: 毫秒级关键词匹配，AI 兜底保证准确率
- **缓存优化**: 意图缓存、模型缓存多级缓存策略

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

## 📝 更新日志

### v1.3.0 (2026-05-21)

**新功能**

- ✨ 意图分类功能，支持关键词匹配 + AI 兜底混合策略
- ✨ 意图关键词管理，支持自定义意图关键词
- ✨ 意图缓存机制，提升分类效率
- ✨ 意图路由日志，记录分类决策过程
- ✨ 意图分类仪表盘，可视化展示分类统计
- ✨ 推理引擎模块化，支持 ReAct、Plan、Reflect、None 四种模式
- ✨ 模型路由调度独立模块，统一管理调度策略
- ✨ 管理后台模型配置页面重构，集成意图分类管理

**改进**

- 🎨 优化智能体推理流程，支持多种推理引擎
- 🎨 优化模型选择逻辑，支持意图分类自动路由
- 🔧 重构智能体模块，分离推理引擎与执行逻辑
- 📝 完善意图分类与智能路由文档

### v1.2.0 (2026-05-16)

**新功能**

- ✨ 应用管理功能，支持多租户应用创建与资源隔离
- ✨ OAuth Scope 细粒度权限控制
- ✨ 会话管理功能，支持会话列表与详情查看
- ✨ 用户端对话界面（client），支持流式对话交互
- ✨ 知识库检索日志功能
- ✨ 函数技能支持（内置函数 / 插件函数 / 沙箱代码）
- ✨ 智能体工作目录文件操作支持
- ✨ 推理步骤可视化展示

**改进**

- 🎨 管理后台 UI 全面重构，统一页面布局风格
- 🎨 优化智能体编辑界面，支持知识库/MCP Server 选择
- 🔧 重构智能体模块，集成 AI SDK
- 🔧 重构多前端静态资源服务与项目构建配置
- 📝 完善项目文档与开发指南

### v1.1.0 (2026-05-09)

**新功能**

- ✨ 提示词模板系统，支持模板化管理和版本控制
- ✨ 模型参数模板，标准化参数配置管理
- ✨ AI 智能技能选择，基于 AI 模型自动选择最佳技能
- ✨ 智能体自定义推理提示词，支持模板选择
- ✨ 技能调用提示词渲染功能

**改进**

- 📝 完善提示词模板使用文档
- 📝 完善模型管理使用文档
- 🎨 优化智能体编辑界面
- 🐛 修复查询参数布尔值验证问题

### v1.0.0 (2026-05-05)

**新功能**

- ✨ 用户透传功能，支持多租户场景
- ✨ 限流配置管理接口
- ✨ 熔断配置管理接口
- ✨ 日志查询支持按 uid 筛选

**Bug 修复**

- 🐛 修复 SSE 数据解析问题
- 🐛 修复 Token 统计为 0 的问题
- 🐛 修复熔断状态数据为空的问题

**改进**

- 📝 完善生产环境部署文档
- 🐳 添加 Docker 部署支持
- 🎨 优化管理后台界面

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 📞 联系方式

- 项目主页: [Muu官网](https://www.muucmf.cc)
- 问题反馈: [Issue Tracker](https://github.com/muucmf/muuai-middle-platform/issues)
- 邮箱: <59262424@qq.com>

## 🙏 致谢

感谢以下开源项目：

- [NestJS](https://nestjs.com/) - 后端框架
- [Vue 3](https://vuejs.org/) - 前端框架
- [Element Plus](https://element-plus.org/) - UI 组件库
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [Qdrant](https://qdrant.tech/) - 向量数据库
- [Swagger](https://swagger.io/) - API 文档
- [Handlebars](https://handlebarsjs.com/) - 模板引擎
- [AI SDK](https://sdk.vercel.ai/) - Vercel AI SDK

***

**Made with ❤️ by MuuAI Team**