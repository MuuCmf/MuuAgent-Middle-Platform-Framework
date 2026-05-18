---
name: web-search
description: 联网搜索技能，使用智谱AI Web Search MCP Server 进行实时网络搜索，获取最新信息。适用于需要查询实时新闻、天气、股票、技术文档等场景。
license: MIT
metadata:
  author: muuai-platform
  version: "1.0.0"
  tags: ["search", "web", "internet", "realtime", "mcp"]
requires:
  mcp-servers:
    - zhipu-web-search-sse
---

# 联网搜索

使用智谱 AI Web Search MCP Server 进行实时网络搜索，获取互联网上的最新信息。

## 功能说明

本技能通过 MCP (Model Context Protocol) 调用智谱 AI 的联网搜索服务，能够：

- 搜索实时新闻和热点事件
- 查询天气、股票等实时数据
- 搜索技术文档和教程
- 获取产品信息和评测
- 查找学术论文和研究报告

## 使用场景

### 1. 实时信息查询

```
用户：今天北京天气怎么样？
助手：[调用 web_search 工具搜索"北京天气 今天"]
```

### 2. 新闻热点追踪

```
用户：最近有什么科技新闻？
助手：[调用 web_search 工具搜索"最新科技新闻"]
```

### 3. 技术问题搜索

```
用户：如何在 Python 中实现异步编程？
助手：[调用 web_search 工具搜索"Python 异步编程教程"]
```

### 4. 产品信息查询

```
用户：iPhone 15 Pro 的价格是多少？
助手：[调用 web_search 工具搜索"iPhone 15 Pro 价格"]
```

## 工具调用

本技能依赖 MCP Server 提供的 `web_search` 工具：

### 工具参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词或问题 |

### 返回结果

返回搜索结果列表，包含：

- 网页标题
- 网页链接
- 内容摘要
- 发布时间（如有）

## 最佳实践

### 1. 精确搜索词

使用具体、明确的搜索词，避免模糊查询：

```
推荐：Python 3.12 新特性详解
不推荐：Python 新版本
```

### 2. 组合关键词

使用多个关键词提高搜索精度：

```
推荐：NestJS 依赖注入 最佳实践 2024
不推荐：NestJS 怎么用
```

### 3. 添加时间限定

对于时效性强的内容，添加时间限定词：

```
推荐：2024年 人工智能发展趋势
不推荐：人工智能发展趋势
```

## 注意事项

1. **网络依赖**：需要网络连接才能正常工作
2. **API 限制**：智谱 AI 可能有调用频率限制
3. **结果验证**：搜索结果来自互联网，建议验证重要信息
4. **隐私保护**：不要搜索敏感个人信息

## 依赖配置

需要在 MCP Server 管理中配置 `zhipu-web-search-sse`：

- **名称**：zhipu-web-search-sse
- **URL**：https://open.bigmodel.cn/api/mcp/web_search_prime/sse
- **API Key**：智谱 AI API Key

## 示例对话

**用户**：帮我查一下 TypeScript 5.0 有什么新特性？

**助手**：我来帮你搜索 TypeScript 5.0 的新特性。

[调用 web_search 工具，参数：{ query: "TypeScript 5.0 新特性" }]

根据搜索结果，TypeScript 5.0 的主要新特性包括：

1. **装饰器标准化** - 支持新的 ECMAScript 装饰器标准
2. **const 类型参数** - 允许泛型参数推断为更精确的字面量类型
3. **extends 多配置支持** - 可以继承多个配置文件
4. **枚举增强** - 支持更多枚举使用场景
5. **性能优化** - 编译速度显著提升

详细信息可以参考 TypeScript 官方博客...
