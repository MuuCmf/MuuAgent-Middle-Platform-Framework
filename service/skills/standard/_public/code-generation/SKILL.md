---
name: code-generation
description: 代码文件生成与编辑技能，使用工作目录（Workspace）的文件操作能力创建、读取、修改项目代码文件。适用于生成新项目、添加功能、修复 Bug、重构代码、编写单元测试等场景。
license: MIT
metadata:
  author: muu-agent
  version: "1.0.0"
  tags: ["code", "generation", "development", "workspace"]
requires:
  workspace: true
allowed-tools: ""
---

# 代码生成（Code Generation）

本技能利用工作目录（Workspace）的文件操作能力，在用户授权的工作目录中生成和编辑代码文件。支持创建新项目、添加功能模块、修复 Bug、编写测试等多种开发场景。

## 核心流程

### 1. 分析需求

理解用户的需求，确定：
- 项目类型和语言（前端/后端/工具库 等）
- 文件结构和目录组织
- 技术栈和依赖

### 2. 规划文件结构

```
project-root/
├── src/
│   ├── index.ts        # 入口文件
│   ├── core/           # 核心逻辑
│   │   └── main.ts
│   └── utils/          # 工具函数
│       └── helper.ts
├── tests/
│   └── main.test.ts    # 单元测试
├── package.json
└── README.md
```

### 3. 创建目录结构

```
create_dir({ path: "项目名/src/core" })
create_dir({ path: "项目名/src/utils" })
create_dir({ path: "项目名/tests" })
```

### 4. 生成代码文件

```
read_dir({ path: "项目名" })
write_file({ path: "项目名/package.json", content: "...", mode: "create" })
write_file({ path: "项目名/src/index.ts", content: "...", mode: "create" })
write_file({ path: "项目名/src/core/main.ts", content: "...", mode: "create" })
```

### 5. 验证生成结果

```
read_dir({ path: "项目名" })
```

## 使用场景

### 场景一：创建新项目

**用户**：帮我创建一个 Express + TypeScript 的后端项目模板

**规划结构**：
```
express-ts-template/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   └── index.ts
│   └── middleware/
│       └── error-handler.ts
├── tsconfig.json
├── package.json
└── .gitignore
```

**执行步骤**：

```
1. create_dir({ path: "express-ts-template/src/routes" })
2. create_dir({ path: "express-ts-template/src/middleware" })
3. write_file({ path: "express-ts-template/package.json", content: "{\n  \"name\": \"express-ts-template\",\n  \"version\": \"1.0.0\",\n  ...\n}", mode: "create" })
4. write_file({ path: "express-ts-template/tsconfig.json", content: "...", mode: "create" })
5. write_file({ path: "express-ts-template/src/index.ts", content: "...", mode: "create" })
6. write_file({ path: "express-ts-template/src/routes/index.ts", content: "...", mode: "create" })
7. write_file({ path: "express-ts-template/src/middleware/error-handler.ts", content: "...", mode: "create" })
8. write_file({ path: "express-ts-template/.gitignore", content: "...", mode: "create" })
```

### 场景二：在已有项目中添加功能

**用户**：在现有项目中添加一个用户注册 API

**步骤**：
```
1. read_file({ path: "现有项目/src/routes/index.ts" })
2. read_file({ path: "现有项目/src/controllers/user.controller.ts" })
3. 分析现有代码风格和模式
4. write_file({ path: "现有项目/src/routes/auth.ts", content: "...", mode: "create" })
5. read_file({ path: "现有项目/src/routes/index.ts" })
6. 如果需要在现有文件中添加导入，先读取内容
   read_file({ path: "现有项目/src/routes/index.ts" })
7. write_file({ path: "现有项目/src/routes/index.ts", content: "更新后的内容", mode: "overwrite" })
```

### 场景三：修改现有代码

**用户**：修复 src/utils/helper.ts 中的 Bug

**步骤**：
```
1. read_file({ path: "项目/src/utils/helper.ts" })
2. 分析问题并修复
3. write_file({ path: "项目/src/utils/helper.ts", content: "修复后的内容", mode: "overwrite" })
```

### 场景四：编写单元测试

**用户**：为 src/services/user.service.ts 编写测试

**步骤**：
```
1. read_file({ path: "项目/src/services/user.service.ts" })
2. read_dir({ path: "项目/tests" })
3. write_file({ path: "项目/tests/user.service.test.ts", content: "...", mode: "create" })
```

## 最佳实践

### 1. 先生成目录，再写入文件

```
// 推荐：先创建目录结构
create_dir({ path: "src/components" })
create_dir({ path: "src/services" })

// 再写入文件
write_file({ path: "src/components/Button.tsx", content: "...", mode: "create" })
write_file({ path: "src/services/api.ts", content: "...", mode: "create" })
```

### 2. 先读取已有文件，了解现有代码风格

```
read_file({ path: "项目/src/existing.ts" })
// 分析命名规范、缩进风格、导入方式等
// 保持新文件与现有代码风格一致
```

### 3. 大项目分步创建

对于包含大量文件的项目，建议分组创建：

1. 先创建配置文件和项目结构：`package.json`, `tsconfig.json`, 目录结构
2. 再创建核心业务逻辑：model, service, controller
3. 最后创建辅助文件：测试、文档、工具脚本

### 4. 写入前确认目录存在

```
read_dir({ path: "项目/src" })
// 确认目录存在后再写入文件
write_file({ path: "项目/src/index.ts", content: "...", mode: "create" })
```

### 5. 使用 create 模式保护已有文件

```
// 新文件使用 create 模式，文件已存在时不会覆盖
write_file({ path: "src/new-file.ts", content: "...", mode: "create" })

// 明确需要覆盖时才使用 overwrite 模式
write_file({ path: "src/existing-file.ts", content: "更新内容", mode: "overwrite" })
```

### 6. 生成完整文件内容

每次写入都提供完整文件内容，不要使用增量修改。
LLM 应一次性生成文件的全部内容，确保语法完整。

## 代码生成规范

### HTML

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面标题</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app"></div>
  <script src="main.js"></script>
</body>
</html>
```

### Vue SFC

```vue
<template>
  <div class="container">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
```

### TypeScript / JavaScript

```typescript
import { defineComponent } from 'vue'

export interface User {
  id: string
  name: string
  email: string
}

export class UserService {
  async findById(id: string): Promise<User | null> {
    // 实现
  }
}
```

### Python

```python
from typing import Optional
from dataclasses import dataclass

@dataclass
class User:
    id: str
    name: str
    email: str

class UserService:
    async def find_by_id(self, user_id: str) -> Optional[User]:
        # 实现
        pass
```

### Go

```go
package main

import (
	"fmt"
	"net/http"
)

type User struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

func main() {
	http.HandleFunc("/", handler)
	http.ListenAndServe(":8080", nil)
}
```

## 注意事项

1. **文件完整性**：每次 `write_file` 写入完整文件内容，不要依赖多次追加拼凑
2. **目录自动创建**：`write_file` 会自动创建父目录，但建议先显式 `create_dir` 以便规划结构
3. **安全性**：不能访问工作目录以外的文件，不能操作可执行文件（`.exe`, `.bat`, `.sh`, `.cmd` 等）
4. **文件大小**：单文件建议控制在 500 行以内，大文件应拆分为多个模块
5. **编码**：所有文件使用 UTF-8 编码
6. **代码质量**：生成的代码应包含必要的注释、类型定义（TypeScript）和错误处理

## 依赖说明

本技能声明 `requires.workspace: true`，自动启用工作目录（Workspace）的文件操作能力，无需手动开启。可用工具包括 `read_file`、`write_file`、`read_dir`、`create_dir`、`append_file`、`delete_file`。
