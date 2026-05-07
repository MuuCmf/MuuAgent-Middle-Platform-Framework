# MuuAI-Middle-Platform

企业级 AI 中台服务，提供统一的 AI 模型管理、智能调度、技能系统、智能体对话等功能。

## 🎯 项目简介

MuuAI-Middle-Platform 是一个基于 NestJS 和 Vue3 构建的企业级 AI 中台服务，旨在为企业提供统一的 AI 能力接入和管理平台。

### 核心价值

- **统一接入**: 一套 API 接入多家 AI 厂商（OpenAI、Azure、阿里云、腾讯云等）
- **智能调度**: 自动负载均衡、故障转移、限流熔断
- **成本优化**: 模型权重调度，智能选择最优模型
- **快速集成**: 标准化 API，支持多语言调用
- **多租户支持**: 用户隔离，数据安全

## ✨ 功能特性

### 🤖 模型管理
- 支持多厂商 AI 模型统一管理
- 模型健康检查与自动监控
- 模型标签与分类管理

### 🔄 智能调度 (MCP)
- 多种调度策略：权重、轮询、随机、故障转移
- 自动负载均衡
- 模型状态监控

### 🛡️ 限流熔断
- 请求限流保护
- 熔断降级机制
- 自动恢复策略

### 🎯 技能系统
- HTTP 技能：调用外部 API
- 函数技能：执行自定义代码
- 数据库技能：查询数据库

### 🤝 智能体
- 基于 LLM 的智能对话
- 自动决策调用技能
- 多轮对话支持

### 👥 用户透传
- 多租户场景支持
- 用户标识透传
- 数据隔离与追踪

### 📊 监控日志
- 完整的调用日志
- 实时统计监控
- 性能分析报告

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     管理后台 (Vue3)                      │
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
│  │ 模型管理  │ MCP调度   │ 技能系统  │ 智能体    │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │ 限流熔断  │ 日志系统  │ 用户透传  │ 监控统计  │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    数据层                                │
│  ┌──────────┬──────────┬──────────┐                     │
│  │  MySQL   │  Redis   │  Prisma  │                     │
│  └──────────┴──────────┴──────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- MySQL 8.0+ 或 SQLite 3
- Redis 6.0+（可选）
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
open http://localhost:3002
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
│   │   └── components/    # 通用组件
│   └── package.json
├── service/               # 后端服务（NestJS）
│   ├── prisma/           # 数据库 Schema
│   ├── src/              # 源代码
│   │   ├── ai/           # AI 调用模块
│   │   ├── agent/        # 智能体模块
│   │   ├── mcp/          # MCP 调度模块
│   │   ├── model/        # 模型管理模块
│   │   ├── rate-limit/   # 限流模块
│   │   └── skill/        # 技能模块
│   └── .env.production   # 生产环境配置
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

## 📚 文档

- [服务 README](service/README.md) - 后端服务详细说明
- [快速部署指南](docs/quick-start.md) - 5 分钟快速部署
- [生产部署文档](docs/production-deployment.md) - 完整的生产环境部署指南
- [用户透传文档](docs/user-pass-through.md) - 多租户用户透传功能说明

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

## 🌐 API 文档

启动服务后访问：
- Swagger 文档: http://localhost:3002/api-docs
- ReDoc 文档: http://localhost:3002/api-docs-json

## 📊 性能特性

- **高并发**: 支持千级并发请求
- **低延迟**: 平均响应时间 < 100ms
- **高可用**: 99.9% 服务可用性
- **自动扩展**: 支持水平扩展

## 🛡️ 安全特性

- API Key 鉴权
- JWT Token 认证
- 请求限流保护
- SQL 注入防护
- XSS 攻击防护
- HTTPS 加密传输

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

- 项目主页: <repository-url>
- 问题反馈: <repository-url>/issues
- 邮箱: support@muuai.com

## 🙏 致谢

感谢以下开源项目：

- [NestJS](https://nestjs.com/) - 后端框架
- [Vue3](https://vuejs.org/) - 前端框架
- [Element Plus](https://element-plus.org/) - UI 组件库
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [Swagger](https://swagger.io/) - API 文档

---

**Made with ❤️ by MuuAI Team**
