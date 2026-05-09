# MuuAI-Middle-Platform

企业级 AI 中台服务，提供统一的 AI 模型管理、智能调度、技能系统、智能体对话、知识库管理、提示词模板等功能。

## 🎯 项目简介

MuuAI-Middle-Platform 是一个基于 NestJS 和 Vue3 构建的企业级 AI 中台服务，旨在为企业提供统一的 AI 能力接入和管理平台。

### 核心价值

- **统一接入**: 一套 API 接入多家 AI 厂商（OpenAI、Azure、阿里云、腾讯云、字节豆包、智谱AI、Ollama 等）
- **智能调度**: 自动负载均衡、故障转移、限流熔断
- **成本优化**: 模型权重调度，智能选择最优模型
- **快速集成**: 标准化 API，支持多语言调用
- **模板化管理**: 提示词模板、模型参数模板标准化管理

## ✨ 功能特性

### 🤖 模型管理
- 支持多厂商 AI 模型统一管理
- 模型类型支持：LLM、Embedding、TTS、ASR、Image、Multimodal
- 模型权重配置与负载均衡
- 模型健康检查与自动监控
- 模型标签与分类管理
- 使用情况统计与分析

### � 模型参数模板
- 标准化参数配置管理
- 温度参数（Temperature）配置
- 核采样参数（TopP）配置
- 上下文窗口（Context Window）配置
- 最大生成长度（Max Tokens）配置
- 场景标签管理（客服问答、创意文案、代码生成等）
- 默认模板设置

### 📝 提示词模板
- 提示词模板化管理
- 模板分类（智能体、RAG、ReAct、技能、自定义）
- 变量系统支持（变量定义、验证、默认值）
- Handlebars 模板语法
- 版本控制与回滚
- 模板渲染引擎

### 🤝 智能体
- 基于 LLM 的智能对话
- 多种推理模式（默认、ReAct、Plan、Reflect）
- 自动决策调用技能
- 多轮对话支持
- 知识库检索集成
- MCP Server 集成
- 自定义推理提示词

### 🛠️ 技能系统
- **HTTP 技能**: 调用外部 API
- **函数技能**: 执行自定义代码
- **数据库技能**: 查询数据库
- **MCP 技能**: 调用 MCP Server 提供的工具
- 技能测试与调试
- AI 智能技能选择
- 技能调用日志

### 📚 知识库管理
- 知识库创建与管理
- 文档上传与解析
- 向量化存储（Qdrant）
- BM25 检索支持
- 混合检索策略
- RAG 问答集成

### 🔌 MCP Server
- Model Context Protocol 支持
- MCP Server 配置管理
- 动态工具发现
- 工具调用管理

### 🔄 智能调度 (MCP)
- 多种调度策略：权重、轮询、随机、故障转移
- 自动负载均衡
- 模型状态监控
- 熔断降级机制

### 🛡️ 限流熔断
- 请求限流保护
- 熔断降级机制
- 自动恢复策略
- 限流配置管理

### 👥 用户透传
- 多租户场景支持
- 用户标识透传
- 数据隔离与追踪
- 用户行为分析

### 🔐 OAuth 认证
- OAuth 2.0 认证支持
- 多客户端管理
- 授权码模式
- Token 管理

### 🔑 权限管理
- 细粒度权限控制
- 角色管理
- 权限分配
- 权限验证

### 📊 监控日志
- AI 模型调用日志
- 智能体对话日志
- 技能调用日志
- RAG 检索日志
- 实时统计监控
- 性能分析报告

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     WEB管理后台 (Vue3)                    │
│                  Element Plus + TypeScript               │
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
│  │ 模型管理  │ 参数模板  │ 提示词模板 │ 智能体    │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ 技能系统  │ 知识库    │ MCP Server│ MCP调度   │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ 限流熔断  │ 日志系统  │ 用户透传  │ 权限管理  │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
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
- MySQL 8.0+ 或 SQLite 3
- Redis 6.0+（可选）
- Qdrant（可选，用于向量检索）
- Docker & Docker Compose（推荐）

### 5 分钟快速部署

```bash
# 1. 克隆项目
git clone <repository-url>
cd MuuAI-Middle-Platform

# 2. 修改配置
vim service/.env.production

# 3. 一键部署
chmod +x deploy/scripts/deploy.sh
./deploy/scripts/deploy.sh

# 4. 访问服务
open http://localhost:9898
```

详细部署说明请查看：
- [快速部署指南](docs/quick-start.md)
- [完整部署文档](docs/production-deployment.md)

## 📁 项目结构

```
MuuAI-Middle-Platform/
├── admin/                  # 管理后台（Vue3）
│   ├── src/
│   │   ├── api/           # API 接口
│   │   ├── views/         # 页面组件
│   │   │   ├── agents/    # 智能体管理
│   │   │   ├── models/    # 模型管理
│   │   │   ├── skills/    # 技能管理
│   │   │   ├── kb/        # 知识库管理
│   │   │   ├── prompt-templates/  # 提示词模板
│   │   │   ├── logs/      # 日志查询
│   │   │   └── ...        # 其他页面
│   │   └── components/    # 通用组件
│   └── package.json
├── service/               # 后端服务（NestJS）
│   ├── prisma/           # 数据库 Schema
│   ├── src/              # 源代码
│   │   ├── ai/           # AI 调用模块
│   │   ├── agent/        # 智能体模块
│   │   ├── model/        # 模型管理模块
│   │   ├── model-template/  # 模型参数模板
│   │   ├── prompt-template/ # 提示词模板
│   │   ├── skill/        # 技能模块
│   │   ├── kb/           # 知识库模块
│   │   ├── retrieval/    # 检索模块
│   │   ├── mcp/          # MCP 调度模块
│   │   ├── mcp-server/   # MCP Server 模块
│   │   ├── rate-limit/   # 限流模块
│   │   ├── oauth/        # OAuth 认证
│   │   ├── permission/   # 权限管理
│   │   └── log/          # 日志模块
│   └── .env.production   # 生产环境配置
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

### 前端开发

```bash
cd admin
npm install
npm run dev
```

### 数据库迁移

```bash
cd service
npx prisma migrate dev
```

### 初始化数据

```bash
cd service
# 初始化管理员账号
npm run init-admin

# 初始化提示词模板
npm run init-templates
```

## 🌐 API 文档

启动服务后访问：
- Swagger 文档: http://localhost:3002/api-docs
- ReDoc 文档: http://localhost:3002/api-docs-json

## 📊 性能特性

- **高并发**: 支持千级并发请求
- **低延迟**: 平均响应时间 < 100ms
- **高可用**: 99.9% 服务可用性
- **自动扩展**: 支持水平扩展
- **智能调度**: 基于权重的负载均衡
- **故障转移**: 自动切换备用模型

## 🛡️ 安全特性

- API Key 鉴权
- JWT Token 认证
- OAuth 2.0 认证
- 请求限流保护
- 熔断降级机制
- SQL 注入防护
- XSS 攻击防护
- HTTPS 加密传输
- 权限细粒度控制

## 🎯 使用场景

### 智能客服
- 多轮对话支持
- 知识库问答
- 技能调用（查询订单、物流等）
- 情感分析与智能路由

### 内容创作
- 创意文案生成
- 文章写作辅助
- 多模态内容生成
- 风格迁移与改写

### 代码开发
- 代码生成与补全
- 代码审查与优化
- 技术文档生成
- Bug 分析与修复建议

### 企业知识管理
- 知识库构建
- 智能检索
- 知识问答
- 文档摘要

### 数据分析
- 数据查询与分析
- 报告生成
- 可视化建议
- 趋势预测

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

### v1.1.0 (2026-05-09)

**新功能**
- ✨ 提示词模板系统，支持模板化管理和版本控制
- ✨ 模型参数模板，标准化参数配置管理
- ✨ AI 智能技能选择，基于 AI 模型自动选择最佳技能
- ✨ 智能体自定义推理提示词，支持模板选择
- ✨ 技能调用提示词渲染功能
- ✨ 前端界面优化，新增提示词模板和技能管理功能

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
- 问题反馈: [Issue Tracker](https://github.com/muuai/muuai-middle-platform/issues)
- 邮箱: 59262424@qq.com

## 🙏 致谢

感谢以下开源项目：

- [NestJS](https://nestjs.com/) - 后端框架
- [Vue3](https://vuejs.org/) - 前端框架
- [Element Plus](https://element-plus.org/) - UI 组件库
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [Qdrant](https://qdrant.tech/) - 向量数据库
- [Swagger](https://swagger.io/) - API 文档
- [Handlebars](https://handlebarsjs.com/) - 模板引擎

---

**Made with ❤️ by MuuAI Team**
