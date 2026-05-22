---
name: workspace
description: 工作目录文件操作能力，允许在用户授权的工作目录中读取、写入、管理文件。当需要读写文件、创建目录、管理项目文件时使用。
requires:
  workspace: true
allowed-tools: ""
---

# Workspace（工作目录）

## 概述

Workspace 提供在用户授权的工作目录中进行文件操作的能力。所有操作均在用户的本地目录中执行，数据不会上传到服务端。

## 可用工具

| 工具名称 | 说明 | 参数 |
|---------|------|------|
| `read_file` | 读取工作目录中的文件内容 | `path`: 文件路径（相对于工作目录） |
| `write_file` | 在工作目录中写入文件 | `path`, `content`, `mode`: create/overwrite |
| `append_file` | 在已有文件末尾追加内容 | `path`, `content` |
| `read_dir` | 列出工作目录中的文件和子目录 | `path`: 目录路径（可选，默认根目录） |
| `create_dir` | 在工作目录中创建文件夹 | `path`: 目录路径 |
| `delete_file` | 删除工作目录中的文件 | `path`: 文件路径 |

## 使用步骤

### 1. 读取文件

```
read_file({ path: "src/index.ts" })
```

### 2. 写入文件

```
write_file({
  path: "src/hello.ts",
  content: "console.log('Hello World');",
  mode: "create"
})
write_file({
  path: "src/hello.ts",
  content: "console.log('Hello World v2');",
  mode: "overwrite"
})
```

### 3. 追加内容

```
append_file({
  path: "src/log.txt",
  content: "2026-05-22: 新日志条目"
})
```

### 4. 列出目录

```
read_dir({})
read_dir({ path: "src" })
```

### 5. 创建目录

```
create_dir({ path: "src/components" })
```

### 6. 删除文件

```
delete_file({ path: "src/old.ts" })
```

## 最佳实践

### 1. 先读后写

```
read_file({ path: "src/config.ts" })
write_file({ path: "src/config.ts", content: "更新后的配置", mode: "overwrite" })
```

### 2. 使用目录结构

```
read_dir({ path: "src" })
create_dir({ path: "src/components" })
write_file({ path: "src/components/Button.tsx", content: "...", mode: "create" })
```

### 3. 文件创建优先使用 create 模式

```
write_file({ path: "新文件.ts", content: "...", mode: "create" })
```

### 4. 大文件操作建议

建议将大文件拆分为多个小文件操作，减少单次操作的数据量。

## 注意事项

1. **数据安全**：所有文件操作仅在用户授权的工作目录范围内，不能访问目录外的文件
2. **网络依赖**：操作在客户端本地执行，不依赖网络连接
3. **文件大小限制**：单文件默认最大 1024KB（1MB），可通过平台配置调整
4. **禁止操作的文件类型**：`.exe`、`.bat`、`.sh`、`.cmd`、`.vbs` 等可执行文件（可通过平台配置调整）
5. **危险操作确认**：删除文件等操作需要用户手动确认
6. **文件编码**：默认支持 UTF-8 编码的文件内容

## 依赖说明

本技能声明的依赖 `requires.workspace: true`，Workspace 的工具定义由平台自动注入，无需手动绑定。
