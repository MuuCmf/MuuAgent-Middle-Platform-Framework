---
name: browser-automation
description: 浏览器自动化操作能力，允许 AI 控制浏览器进行页面导航、截图、点击、填充表单、执行脚本等操作。适用于网页自动化测试、数据采集、表单自动填写、页面内容提取等场景。
license: MIT
metadata:
  author: muu-agent
  version: "1.0.0"
  tags: ["browser", "automation", "puppeteer", "screenshot", "scraping"]
requires:
  browser: true
allowed-tools: ""
---

# 浏览器自动化（Browser Automation）

## 概述

浏览器自动化提供对浏览器的完整控制能力，包括页面导航、截图、元素交互、脚本执行、内容提取等功能。

> **安全警告**：部分高风险操作（如导航、脚本执行、表单填充）需要用户手动确认。请仅在明确获得用户授权时使用。

## 可用工具

| 工具名称 | 说明 | 关键参数 | 确认模式 |
|---------|------|---------|---------|
| `browser_navigate` | 导航到指定 URL | `url`: 目标地址，`waitUntil`: 等待条件 | confirm |
| `browser_screenshot` | 截取页面截图 | `format`: png/jpeg/webp，`fullPage`: 全页截图，`selector`: 元素选择器 | auto |
| `browser_click` | 点击页面元素 | `selector`: 元素选择器，`clickCount`: 点击次数 | auto |
| `browser_fill` | 填充表单字段 | `selector`: 元素选择器，`value`: 填充值，`clear`: 是否清空 | confirm |
| `browser_evaluate` | 执行 JavaScript 脚本 | `script`: 脚本内容，`timeout`: 超时时间 | confirm |
| `browser_wait` | 等待特定条件 | `type`: selector/timeout/function/navigation，`target`: 等待目标 | auto |
| `browser_scroll` | 滚动页面 | `direction`: up/down/left/right/top/bottom，`distance`: 滚动距离 | auto |
| `browser_get_content` | 获取页面内容 | `contentType`: text/html/markdown/json，`selector`: 元素选择器 | auto |
| `browser_select` | 选择下拉框选项 | `selector`: 下拉框选择器，`value`: 选项值，`selectBy`: value/text/index | auto |
| `browser_hover` | 悬停在元素上 | `selector`: 元素选择器 | auto |
| `browser_close` | 关闭浏览器或页面 | `pageId`: 页面标识，`closeBrowser`: 是否关闭整个浏览器 | auto |

## 触发条件

当用户提出以下需求时，应使用浏览器自动化工具：

- **页面导航**："打开这个网页"、"访问 xxx.com"、"跳转到登录页"
- **截图**："截取这个页面"、"截取整个网页"、"截取某个元素"
- **点击操作**："点击登录按钮"、"点击那个链接"、"双击这个元素"
- **表单填写**："在搜索框输入 xxx"、"填写用户名和密码"、"清空输入框"
- **脚本执行**："在页面上执行这段代码"、"获取页面上的某个变量"
- **等待加载**："等待页面加载完成"、"等待某个元素出现"
- **滚动页面**："滚动到底部"、"向上滚动一屏"、"滚动到某个元素"
- **内容提取**："获取页面文本"、"提取页面 HTML"、"把页面转成 Markdown"
- **下拉选择**："选择下拉框的第二个选项"、"选择值为 xxx 的选项"
- **悬停操作**："鼠标悬停在菜单上"、"悬停显示下拉内容"
- **关闭页面**："关闭当前标签页"、"关闭浏览器"

## 使用步骤

### 1. 导航到页面

```
browser_navigate({ url: "https://example.com" })
browser_navigate({ url: "https://example.com", waitUntil: "networkidle0", timeout: 60000 })
```

### 2. 截取页面

```
// 截取可视区域
browser_screenshot({ format: "png" })

// 截取整个页面
browser_screenshot({ format: "png", fullPage: true })

// 截取特定元素
browser_screenshot({ selector: "#main-content", format: "png" })

// 控制图片大小
browser_screenshot({ format: "jpeg", quality: 80, maxWidth: 800 })
```

### 3. 点击元素

```
// 单击
browser_click({ selector: "#submit-button" })

// 双击
browser_click({ selector: ".item", clickCount: 2 })

// 带延迟的点击
browser_click({ selector: "#button", delay: 100 })
```

### 4. 填充表单

```
// 填充输入框
browser_fill({ selector: "#username", value: "admin" })

// 填充并清空现有内容
browser_fill({ selector: "#search", value: "搜索内容", clear: true })

// 模拟打字效果
browser_fill({ selector: "#input", value: "Hello", delay: 50 })
```

### 5. 执行脚本

```
// 获取页面标题
browser_evaluate({ script: "return document.title" })

// 获取元素文本
browser_evaluate({ script: "return document.querySelector('#content').innerText" })

// 复杂操作
browser_evaluate({ 
  script: `
    const items = document.querySelectorAll('.item');
    return Array.from(items).map(item => item.textContent);
  `,
  timeout: 30000
})
```

### 6. 等待条件

```
// 等待元素出现
browser_wait({ type: "selector", target: ".loaded-element" })

// 等待固定时间
browser_wait({ type: "timeout", target: "3000" })

// 等待导航完成
browser_wait({ type: "navigation", waitUntil: "load" })

// 等待自定义函数
browser_wait({ 
  type: "function", 
  target: "() => document.querySelectorAll('.item').length > 5" 
})
```

### 7. 滚动页面

```
// 向下滚动
browser_scroll({ direction: "down", distance: 300 })

// 滚动到顶部
browser_scroll({ direction: "top" })

// 滚动到底部
browser_scroll({ direction: "bottom" })

// 滚动到特定元素
browser_scroll({ selector: "#footer" })
```

### 8. 获取内容

```
// 获取纯文本
browser_get_content({ contentType: "text" })

// 获取 HTML
browser_get_content({ contentType: "html" })

// 转换为 Markdown
browser_get_content({ contentType: "markdown" })

// 获取特定元素内容
browser_get_content({ contentType: "text", selector: "#article" })

// 获取 JSON 数据
browser_get_content({ contentType: "json", selector: "script[type='application/json']" })
```

### 9. 选择下拉框

```
// 按值选择
browser_select({ selector: "#country", value: "cn", selectBy: "value" })

// 按文本选择
browser_select({ selector: "#country", value: "中国", selectBy: "text" })

// 按索引选择
browser_select({ selector: "#country", value: "0", selectBy: "index" })
```

### 10. 悬停操作

```
browser_hover({ selector: ".dropdown-trigger" })
```

### 11. 关闭浏览器

```
// 关闭特定页面
browser_close({ pageId: "page-1" })

// 关闭整个浏览器
browser_close({ closeBrowser: true })
```

## 常见场景

### 场景一：网页截图

用户："帮我截取这个网页的全屏截图"

```
1. browser_navigate({ url: "目标网址" })
2. browser_wait({ type: "navigation", waitUntil: "networkidle0" })
3. browser_screenshot({ format: "png", fullPage: true })
```

### 场景二：自动登录

用户："帮我自动登录 xxx 网站"

```
1. browser_navigate({ url: "https://xxx.com/login" })
2. browser_wait({ type: "selector", target: "#username" })
3. browser_fill({ selector: "#username", value: "用户名" })
4. browser_fill({ selector: "#password", value: "密码" })
5. browser_click({ selector: "#login-button" })
6. browser_wait({ type: "navigation", waitUntil: "load" })
7. browser_screenshot({}) // 验证登录结果
```

### 场景三：数据采集

用户："帮我提取这个页面的所有商品信息"

```
1. browser_navigate({ url: "商品列表页" })
2. browser_wait({ type: "selector", target: ".product-item" })
3. browser_evaluate({ 
   script: `
     const items = document.querySelectorAll('.product-item');
     return Array.from(items).map(item => ({
       name: item.querySelector('.name')?.textContent,
       price: item.querySelector('.price')?.textContent,
       link: item.querySelector('a')?.href
     }));
   `
 })
```

### 场景四：表单自动填写

用户："帮我填写这个表单"

```
1. browser_navigate({ url: "表单页面" })
2. browser_fill({ selector: "#name", value: "张三" })
3. browser_fill({ selector: "#email", value: "zhangsan@example.com" })
4. browser_select({ selector: "#city", value: "北京", selectBy: "text" })
5. browser_click({ selector: "#submit" })
```

### 场景五：无限滚动页面

用户："帮我滚动加载更多内容"

```
1. browser_navigate({ url: "目标页面" })
2. 循环执行:
   - browser_scroll({ direction: "bottom" })
   - browser_wait({ type: "timeout", target: "2000" })
   - 检查是否还有新内容加载
3. browser_get_content({ contentType: "markdown" })
```

## 最佳实践

### 1. 导航后等待

导航到新页面后，始终等待页面加载完成再执行后续操作。

```
browser_navigate({ url: "xxx", waitUntil: "networkidle0" })
// 或
browser_navigate({ url: "xxx" })
browser_wait({ type: "selector", target: "#main-content" })
```

### 2. 操作前验证元素

在操作元素前，先等待元素出现。

```
browser_wait({ type: "selector", target: "#button" })
browser_click({ selector: "#button" })
```

### 3. 截图验证结果

关键操作后截图验证结果。

```
browser_click({ selector: "#submit" })
browser_wait({ type: "navigation", waitUntil: "load" })
browser_screenshot({}) // 验证操作结果
```

### 4. 使用选择器最佳实践

```
// 推荐：使用语义化 ID
browser_click({ selector: "#submit-button" })

// 推荐：使用明确的类名组合
browser_click({ selector: ".form-actions .submit-btn" })

// 避免：过于宽泛的选择器
browser_click({ selector: "div button" })
```

### 5. 处理动态内容

```
// 等待网络空闲
browser_wait({ type: "navigation", waitUntil: "networkidle0" })

// 等待特定元素
browser_wait({ type: "selector", target: ".loaded" })

// 等待自定义条件
browser_wait({ 
  type: "function",
  target: "() => document.querySelector('.status')?.textContent === '完成'"
})
```

### 6. 多页面管理

```
// 使用 pageId 区分不同页面
browser_navigate({ url: "page1", pageId: "page-1" })
browser_navigate({ url: "page2", pageId: "page-2" })

// 在特定页面操作
browser_click({ selector: "#button", pageId: "page-1" })
```

## 安全注意事项

1. **用户确认**：以下操作需要用户确认后才能执行：
   - `browser_navigate` - 导航到新页面
   - `browser_fill` - 填充表单字段
   - `browser_evaluate` - 执行 JavaScript 脚本（高风险）

2. **脚本执行风险**：`browser_evaluate` 可以执行任意 JavaScript 代码，存在安全风险，请谨慎使用

3. **敏感信息保护**：
   - 不要在脚本中硬编码密码、令牌等敏感信息
   - 截图可能包含敏感信息，注意保护

4. **网络访问限制**：
   - 仅访问用户明确授权的网站
   - 不要访问恶意网站或执行恶意操作

5. **操作频率控制**：避免过于频繁的操作，可能对目标网站造成压力

6. **跨域限制**：浏览器安全策略可能限制某些跨域操作

## 依赖说明

本技能声明依赖 `requires.browser: true`，浏览器自动化工具定义由平台自动注入，无需手动绑定。仅在支持浏览器自动化的客户端环境下可用。