---
name: desktop-automation
description: 桌面自动化操作能力，允许 AI 控制用户的鼠标、键盘、剪贴板、执行终端命令、截取屏幕和获取窗口信息。当需要操作桌面应用、自动化重复任务、获取屏幕信息、执行系统命令时使用。
license: MIT
metadata:
  author: muu-agent
  version: "1.0.0"
  tags: ["desktop", "automation", "mouse", "keyboard", "screenshot"]
requires:
  desktopAutomation: true
allowed-tools: ""
---

# 桌面自动化（Desktop Automation）

## 概述

桌面自动化提供对用户计算机的系统级操作能力，包括截屏、鼠标控制、键盘输入、命令行执行、剪贴板操作和窗口管理。

> **安全警告**：所有高风险操作需要用户手动确认。命令执行受黑名单保护，危险命令会被自动拦截。请仅在明确获得用户授权时使用。

## 可用工具

| 工具名称 | 说明 | 关键参数 |
|---------|------|---------|
| `desktop_screenshot` | 截取当前屏幕，返回 Base64 编码图片 | `screen`: 显示器索引，`format`: png/jpg，`maxWidth`: 最大宽度 |
| `desktop_mouse` | 鼠标操作：点击、移动、拖拽、滚动、获取位置 | `action`: left_click/right_click/double_click/move/drag/scroll/position，`x`,`y`: 坐标 |
| `desktop_keyboard` | 键盘操作：输入文本、按键、组合键 | `action`: type/press/shortcut，`text`: 输入文本，`keys`: 组合键数组 |
| `desktop_execute` | 执行终端命令并返回输出 | `command`: 命令，`cwd`: 工作目录，`timeout`: 超时毫秒 |
| `desktop_clipboard` | 剪贴板操作：读取、写入 | `action`: read/write，`content`: 写入内容 |
| `desktop_window` | 窗口管理：列出窗口、获取活动窗口 | `action`: list/active，`title`: 标题过滤 |

## 触发条件

当用户提出以下需求时，应使用桌面自动化工具：

- **截取屏幕**："看看我的桌面"、"截图当前窗口"、"这个页面显示什么"
- **鼠标操作**："点击那个按钮"、"把鼠标移到右下角"、"双击桌面上的文件夹"
- **键盘输入**："在搜索框输入 xxx"、"按 Ctrl+C 复制"、"按回车确认"
- **命令执行**："查询系统信息"、"帮我运行 npm install"、"查看进程列表"
- **剪贴板**："读取剪贴板内容"、"把这段文字复制到剪贴板"
- **窗口管理**："当前打开了哪些窗口"、"获取活动窗口标题"

## 使用步骤

### 1. 截取屏幕

先截图获取当前桌面状态，分析后决定下一步操作。

```
desktop_screenshot({})
desktop_screenshot({ screen: 0, format: "png", maxWidth: 1280 })
```

### 2. 鼠标点击

截图分析确认位置后，执行点击操作。

```
desktop_screenshot({})
// 分析截图，确定目标坐标 (x=500, y=300)
desktop_mouse({ action: "left_click", x: 500, y: 300 })
```

### 3. 键盘输入

```
// 输入文本
desktop_keyboard({ action: "type", text: "Hello World" })

// 组合键 - 全选
desktop_keyboard({ action: "shortcut", keys: ["Control", "a"] })

// 组合键 - 复制
desktop_keyboard({ action: "shortcut", keys: ["Control", "c"] })

// 组合键 - 粘贴
desktop_keyboard({ action: "shortcut", keys: ["Control", "v"] })
```

### 4. 执行命令

```
// 简单命令
desktop_execute({ command: "dir" })

// 指定工作目录和超时
desktop_execute({ command: "npm test", cwd: "C:/projects/my-app", timeout: 60000 })

// 获取系统信息
desktop_execute({ command: "systeminfo" })
```

### 5. 剪贴板操作

```
// 读取剪贴板
desktop_clipboard({ action: "read" })

// 写入剪贴板
desktop_clipboard({ action: "write", content: "要复制的内容" })
```

### 6. 窗口管理

```
// 列出所有窗口
desktop_window({ action: "list" })

// 按标题过滤
desktop_window({ action: "list", title: "VS Code" })

// 获取当前活动窗口
desktop_window({ action: "active" })
```

## 常见场景

### 场景一：截图分析后操作

用户："帮我打开桌面的 '项目文档' 文件夹"

```
1. desktop_screenshot({})
2. 分析截图，定位 "项目文档" 图标位置
3. desktop_mouse({ action: "double_click", x: 坐标x, y: 坐标y })
```

### 场景二：自动化安装

用户："帮我安装这个依赖包"

```
1. desktop_keyboard({ action: "shortcut", keys: ["Control", "r"] })
2. desktop_keyboard({ action: "type", text: "cmd" })
3. desktop_keyboard({ action: "press", text: "Enter" })
4. desktop_keyboard({ action: "type", text: "cd C:\\projects\\my-app && npm install express" })
5. desktop_keyboard({ action: "press", text: "Enter" })
```

### 场景三：信息采集

用户："当前系统运行状态如何"

```
1. desktop_execute({ command: "tasklist" })
2. desktop_execute({ command: "systeminfo | findstr /C:\"Total Physical Memory\" /C:\"Available Physical Memory\"" })
```

### 场景四：文本处理

用户："把剪贴板里的内容改成大写"

```
1. desktop_clipboard({ action: "read" })
2. 处理内容转为大写
3. desktop_clipboard({ action: "write", content: "处理后的内容" })
```

## 最佳实践

### 1. 先截图，后操作

始终先截取屏幕确认当前状态，再执行操作。不要盲目假设桌面状态。

```
desktop_screenshot({})
// 分析后再操作
desktop_mouse({ action: "left_click", x: ..., y: ... })
```

### 2. 操作后验证

执行关键操作后，再次截图验证结果。

```
desktop_mouse({ action: "left_click", x: 500, y: 300 })
await sleep(500)
desktop_screenshot({})
// 验证点击是否生效
```

### 3. 组合键优先于逐字输入

使用快捷键代替逐字输入大量文本，提高效率。

```
// 推荐：使用组合键
desktop_keyboard({ action: "shortcut", keys: ["Control", "a"] })
desktop_keyboard({ action: "shortcut", keys: ["Control", "c"] })

// 避免：逐字符输入大段文字
```

### 4. 命令执行使用完整路径

```
desktop_execute({ command: "npm install", cwd: "C:/projects/my-app" })
```

### 5. 滚动查看不可见内容

```
// 截图发现内容不对
desktop_screenshot({})
// 滚动页面
desktop_mouse({ action: "scroll", scrollY: -300 })
// 再次截图
desktop_screenshot({})
```

## 安全注意事项

1. **用户确认**：鼠标点击、键盘输入、命令执行等操作需要用户确认后才能执行
2. **命令黑名单**：以下类型的命令会被自动拦截：
   - 文件删除：`rm -rf`、`del /f /s`
   - 磁盘格式化：`format`
   - 系统关机：`shutdown`、`Restart-Computer`
   - 注册表修改等危险操作
3. **操作频率限制**：每分钟最多执行 30 次操作（可配置），防止恶意批量操作
4. **仅在 Desktop 客户端可用**：桌面自动化仅支持 Electron Desktop 客户端，Web 浏览器中不可用
5. **明确授权范围**：仅执行用户明确要求的操作，不要超出用户授权范围
6. **敏感信息保护**：截图可能包含敏感信息，注意不要记录或传播

## 依赖说明

本技能声明依赖 `requires.desktopAutomation: true`，桌面自动化工具定义由平台自动注入，无需手动绑定。仅在 Electron Desktop 客户端环境下可用。