# MuuAgent 管理后台

这是一个基于 Vue 3 + TypeScript + Vite + Element Plus 构建的现代化前端项目。

## 项目说明

本前端项目与 `service` 后端项目平级放置，采用前后端分离架构：

```
MuuAgent/
├── admin/          # 前端项目（本目录）
├── service/        # 后端项目（NestJS）
└── docs/           # 项目文档
```

构建后的静态文件会输出到 `service/public` 目录，由后端服务提供静态文件服务。

## 技术栈

- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - JavaScript 的超集，提供类型安全
- **Vite** - 下一代前端构建工具
- **Vue Router** - Vue.js 官方路由
- **Pinia** - Vue 状态管理库
- **Element Plus** - 基于 Vue 3 的组件库
- **Axios** - HTTP 客户端
- **Sass** - CSS 预处理器

## 项目结构

```
admin/
├── src/
│   ├── api/          # API 接口定义
│   ├── assets/       # 静态资源
│   ├── components/   # 公共组件
│   ├── layouts/      # 布局组件
│   ├── router/       # 路由配置
│   ├── stores/       # 状态管理
│   ├── styles/       # 全局样式
│   ├── utils/        # 工具函数
│   ├── views/        # 页面组件
│   ├── App.vue       # 根组件
│   └── main.ts       # 入口文件
├── index.html        # HTML 模板
├── package.json      # 项目依赖
├── tsconfig.json     # TypeScript 配置
└── vite.config.ts    # Vite 配置
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 类型检查
npm run type-check
```

## 功能模块

- **仪表盘** - 展示中台的整体运行状态
- **模型管理** - 管理AI模型配置
- **MCP调度** - 监控模型状态和熔断保护
- **技能管理** - 管理智能体可调用的技能
- **智能体** - 创建和管理AI助手
- **AI对话** - 测试AI模型和智能体
- **调用日志** - 查看历史调用记录

## 代理配置

开发环境已配置代理，将 `/api` 请求代理到 `http://localhost:3001`。

如需修改，请编辑 `vite.config.ts` 中的 `server.proxy` 配置。
