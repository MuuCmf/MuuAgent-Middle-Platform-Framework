---
name: system-control
description: 系统控制能力，允许在用户桌面端控制应用程序、截屏、管理剪贴板、执行命令等系统级操作。仅在桌面客户端中可用。
requires:
  system-control: true
allowed-tools: ""
---

# System Control（系统控制）

## 概述

System Control 提供对用户桌面系统的控制能力，包括应用程序管理、屏幕截图、音量控制、剪贴板操作、文件搜索、窗口管理、通知发送、命令执行等。所有操作均在用户的桌面客户端本地执行，需要用户在桌面端登录使用。

## 可用工具

### 应用程序管理

| 工具名称 | 说明 | 参数 |
|---------|------|------|
| `launch_application` | 启动应用程序 | `name`: 应用名称（如"微信"、"Chrome"） |
| `close_application` | 关闭正在运行的应用程序 | `name`: 应用名称 |
| `list_processes` | 列出正在运行的进程列表 | 无 |

### 屏幕与窗口

| 工具名称 | 说明 | 参数 |
|---------|------|------|
| `take_screenshot` | 截取当前屏幕画面 | 无 |
| `list_open_windows` | 列出所有打开的窗口标题 | 无 |
| `switch_to_window` | 切换到指定窗口 | `title`: 窗口标题关键词 |

### 音量控制

| 工具名称 | 说明 | 参数 |
|---------|------|------|
| `set_volume` | 设置系统音量 | `level`: 音量级别 0-100 |
| `get_volume` | 获取当前系统音量 | 无 |

### 剪贴板

| 工具名称 | 说明 | 参数 |
|---------|------|------|
| `read_clipboard` | 读取系统剪贴板内容 | 无 |
| `write_clipboard` | 写入内容到系统剪贴板 | `text`: 要写入的文本 |

### 文件操作

| 工具名称 | 说明 | 参数 |
|---------|------|------|
| `search_files` | 在指定目录下搜索文件 | `query`: 搜索关键词，`basePath`: 搜索根目录（可选） |
| `open_file` | 用系统默认程序打开文件 | `path`: 文件路径 |

### 系统操作（高危）

| 工具名称 | 说明 | 参数 |
|---------|------|------|
| `show_notification` | 显示系统通知 | `title`: 通知标题，`body`: 通知内容 |
| `execute_command` | 在终端执行系统命令 | `command`: 要执行的命令，`timeout`: 超时毫秒数（可选，默认 10000） |
| `shutdown` | 关闭计算机 | 无 |
| `sleep` | 使计算机进入睡眠状态 | 无 |

## 使用示例

### 1. 启动应用

```
launch_application({ name: "微信" })
launch_application({ name: "Chrome" })
```

### 2. 截取屏幕

```
take_screenshot()
```

### 3. 音量控制

```
get_volume()
set_volume({ level: 50 })
```

### 4. 剪贴板操作

```
write_clipboard({ text: "Hello World" })
read_clipboard()
```

### 5. 搜索文件

```
search_files({ query: "报告.docx" })
search_files({ query: "photo.jpg", basePath: "C:/Users" })
```

### 6. 窗口管理

```
list_open_windows()
switch_to_window({ title: "Chrome" })
```

### 7. 发送通知

```
show_notification({ title: "提醒", body: "任务已完成！" })
```

### 8. 执行命令

```
execute_command({ command: "dir C:\\" })
execute_command({ command: "ipconfig", timeout: 5000 })
```

## 最佳实践

### 1. 先查询再操作

在关闭应用或切换窗口前，先查询当前状态：

```
list_processes()
close_application({ name: "微信" })
```

### 2. 截屏辅助判断

当需要了解用户当前桌面状态时，先截屏：

```
take_screenshot()
```

### 3. 剪贴板作为数据中转

将需要传递的数据写入剪贴板，方便用户粘贴：

```
write_clipboard({ text: "生成的文本内容" })
```

### 4. 通知反馈

执行耗时操作后发送通知提醒用户：

```
execute_command({ command: "npm run build" })
show_notification({ title: "构建完成", body: "项目构建已结束" })
```

## 注意事项

1. **桌面端专用**：所有系统控制操作仅在桌面客户端中可用，Web 端无法使用
2. **安全限制**：`execute_command`、`shutdown`、`sleep` 为高危操作，需要用户手动确认
3. **命令沙箱**：`execute_command` 执行的命令受黑名单限制，危险命令会被拦截
4. **超时机制**：普通操作超时 30 秒，高危操作超时 60 秒
5. **隐私保护**：截屏和剪贴板内容可能包含敏感信息，请谨慎处理

## 依赖说明

本技能声明的依赖 `requires.system-control: true`，System Control 的工具定义由平台自动注入，无需手动绑定。
