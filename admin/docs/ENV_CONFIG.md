# 环境变量配置说明

## 概述

本项目使用环境变量来管理配置，支持不同环境（开发、生产）的配置隔离。

## 快速开始

### 1. 复制环境变量模板

```bash
cp .env.example .env.development
```

### 2. 修改配置

编辑 `.env.development` 文件，填写实际的配置值：

```env
# API基础路径
VITE_API_BASE_URL=/api

# API密钥（请修改为实际的API密钥）
VITE_API_KEY=your-api-key-here

# 应用标题
VITE_APP_TITLE=MuuAI中台管理系统

# 应用端口
VITE_PORT=5173
```

## 环境变量说明

| 变量名 | 说明 | 默认值 | 是否必需 |
|--------|------|--------|----------|
| `VITE_API_BASE_URL` | API基础路径 | `/api` | 否 |
| `VITE_API_KEY` | API密钥 | - | 是 |
| `VITE_APP_TITLE` | 应用标题 | `MuuAI中台管理系统` | 否 |
| `VITE_PORT` | 应用端口 | `5173` | 否 |

## 环境文件

项目支持以下环境文件：

- `.env` - 所有环境共享的配置
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置
- `.env.local` - 本地覆盖配置（不提交到git）
- `.env.development.local` - 开发环境本地覆盖（不提交到git）
- `.env.production.local` - 生产环境本地覆盖（不提交到git）

### 优先级

环境变量的优先级从高到低：

1. `.env.[mode].local`
2. `.env.[mode]`
3. `.env.local`
4. `.env`

## 使用示例

### 在代码中使用

```typescript
import { appConfig } from '@/config'

// 使用API基础路径
const apiUrl = appConfig.apiBaseUrl

// 使用API密钥
const apiKey = appConfig.apiKey

// 使用应用标题
const title = appConfig.appTitle
```

### 在组件中使用

```vue
<script setup lang="ts">
import { appConfig } from '@/config'

console.log('API基础路径:', appConfig.apiBaseUrl)
console.log('应用标题:', appConfig.appTitle)
</script>
```

## 安全建议

1. **不要提交敏感信息**：`.env.development` 和 `.env.production` 文件已添加到 `.gitignore`，不会被提交到git
2. **使用示例文件**：`.env.example` 文件可以提交，但不要包含真实的密钥
3. **生产环境密钥**：生产环境的API密钥应该通过CI/CD流程或配置管理系统注入
4. **定期更换密钥**：建议定期更换API密钥，提高安全性

## 开发环境配置

开发环境使用 `.env.development` 文件：

```env
VITE_API_BASE_URL=/api
VITE_API_KEY=AI-SVC-2026-MCP-KEY-666
VITE_APP_TITLE=MuuAI中台管理系统（开发）
VITE_PORT=5173
```

## 生产环境配置

生产环境使用 `.env.production` 文件：

```env
VITE_API_BASE_URL=/api
VITE_API_KEY=your-production-api-key
VITE_APP_TITLE=MuuAI中台管理系统
VITE_PORT=5173
```

## 验证配置

应用启动时会自动验证配置，如果配置不完整会在控制台输出错误信息。

开发环境下，应用启动时会在控制台打印当前配置信息，方便调试。

## 常见问题

### Q: 为什么我的环境变量没有生效？

A: 请检查：
1. 环境变量文件是否在项目根目录
2. 环境变量名是否以 `VITE_` 开头（Vite要求）
3. 是否重启了开发服务器

### Q: 如何查看当前使用的配置？

A: 在开发环境下，打开浏览器控制台，应用启动时会打印配置信息。

### Q: 如何在不同环境使用不同的API地址？

A: 在 `.env.development` 和 `.env.production` 中分别配置不同的 `VITE_API_BASE_URL` 值。

## 相关文件

- [配置管理模块](../src/config/index.ts)
- [类型定义](../src/vite-env.d.ts)
- [请求工具](../src/utils/request.ts)
