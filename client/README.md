# MuuAgent 用户端

一个现代化的AI对话界面，采用类似豆包、元宝等大厂的设计风格。

## ✨ 特性

- 🎨 **现代化设计** - 简洁优雅的UI界面
- 💬 **实时对话** - 支持流式响应
- 📝 **会话管理** - 完整的会话历史管理
- 🤖 **模型选择** - 支持MCP调度和手动选择模型
- 🔄 **多轮对话** - 自动维护对话上下文
- 📱 **响应式** - 适配不同屏幕尺寸

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境

创建 `.env.development` 文件：

```env
VITE_API_BASE_URL=http://localhost:3000
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 📦 技术栈

- **Vue 3** - 渐进式JavaScript框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Pinia** - 状态管理
- **Element Plus** - UI组件库
- **Marked** - Markdown解析

## 📖 文档

详细的开发文档请查看 [client-development-guide.md](../development_docs/client-development-guide.md)

## 🎯 功能列表

- [x] 实时对话
- [x] 会话管理
- [x] 模型选择
- [x] 多轮对话
- [x] Markdown渲染
- [x] 代码高亮
- [ ] 语音输入
- [ ] 图片识别
- [ ] 文件上传

## 📝 开发规范

- 使用组合式API
- 使用TypeScript
- 遵循Vue 3最佳实践
- 组件使用`<script setup>`语法

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License
