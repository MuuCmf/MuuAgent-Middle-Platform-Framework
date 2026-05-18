# 提示词模板使用指南

## 📖 目录

- [概述](#概述)
- [功能特性](#功能特性)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [API 接口文档](#api-接口文档)
- [集成指南](#集成指南)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [示例代码](#示例代码)

---

## 概述

提示词模板系统是一个强大的提示词管理平台，支持模板的创建、编辑、版本控制、变量管理和智能渲染。通过模板化的方式管理提示词，可以提高提示词的复用性、可维护性和一致性。

### 核心价值

- **标准化管理**：统一管理所有场景的提示词模板
- **版本控制**：支持模板版本历史记录和回滚
- **变量系统**：支持动态变量注入和模板渲染
- **分类管理**：按场景分类管理模板（智能体、RAG、ReAct、技能等）
- **智能集成**：与智能体、RAG问答、技能调用等系统深度集成

---

## 功能特性

### 1. 模板管理

- ✅ 创建、编辑、删除模板
- ✅ 模板分类管理（agent、rag、react、skill、custom）
- ✅ 模板状态管理（启用/禁用）
- ✅ 默认模板设置
- ✅ 模板标签和元数据

### 2. 版本控制

- ✅ 自动版本记录
- ✅ 版本历史查看
- ✅ 版本回滚
- ✅ 变更日志

### 3. 变量系统

- ✅ 变量定义（名称、类型、是否必填、默认值、描述）
- ✅ 变量类型支持（string、number、boolean、array、object）
- ✅ 变量验证
- ✅ 默认值支持

### 4. 模板渲染

- ✅ Handlebars 语法支持
- ✅ 条件渲染（`{{#if}}`）
- ✅ 循环渲染（`{{#each}}`）
- ✅ 变量插值（`{{variable}}`）

### 5. 智能集成

- ✅ 智能体系统集成
- ✅ RAG 问答系统集成
- ✅ 技能调用系统集成
- ✅ AI 模型智能选择

---

## 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                   前端管理界面                           │
│              (Vue 3 + TypeScript + Element Plus)        │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   API 接口层                             │
│              (RESTful API + Swagger)                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   业务逻辑层                             │
│              (PromptTemplateService)                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   数据持久层                             │
│              (Prisma + MySQL)                           │
└─────────────────────────────────────────────────────────┘
```

### 数据模型

```prisma
model PromptTemplate {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  category    String
  content     String   @db.Text
  variables   String?  @db.Text
  version     Int      @default(1)
  isDefault   Boolean  @default(false)
  status      Boolean  @default(true)
  description String?  @db.Text
  tags        String?
  metadata    String?  @db.Text
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  versions    PromptVersion[]
}

model PromptVersion {
  id          String   @id @default(uuid())
  templateId  String
  version     Int
  content     String   @db.Text
  variables   String?  @db.Text
  changeLog   String?  @db.Text
  changeType  String
  createdBy   String?
  createdAt   DateTime @default(now())

  template    PromptTemplate @relation(fields: [templateId], references: [id])
}
```

---

## 快速开始

### 1. 访问管理界面

启动前端服务后，访问提示词模板管理页面：

```
http://localhost:5173/prompt-templates
```

### 2. 创建第一个模板

点击"添加模板"按钮，填写以下信息：

- **名称**：RAG问答提示词
- **标识**：rag-chat-default
- **分类**：rag
- **内容**：
```handlebars
你是一个专业的问答助手。请根据以下参考信息回答用户问题。

## 参考信息
{{context}}

## 用户问题
{{question}}

## 回答要求
1. 基于参考信息准确回答
2. 如果参考信息不足，请明确说明
3. 使用友好、专业的语气
```

- **变量定义**：
```json
[
  {
    "name": "context",
    "type": "string",
    "required": true,
    "description": "参考信息"
  },
  {
    "name": "question",
    "type": "string",
    "required": true,
    "description": "用户问题"
  }
]
```

### 3. 使用模板

通过 API 调用模板：

```bash
curl -X POST http://localhost:3000/api/admin/prompt-template/render \
  -H "Content-Type: application/json" \
  -d '{
    "code": "rag-chat-default",
    "variables": {
      "context": "北京今天的天气是晴天，气温25度。",
      "question": "北京今天天气怎么样？"
    }
  }'
```

---

## 使用指南

### 模板分类

系统支持以下模板分类：

| 分类 | 说明 | 使用场景 |
|------|------|----------|
| `agent` | 智能体系统提示词 | 智能体角色定义、行为规范 |
| `rag` | RAG 问答提示词 | 知识库问答、文档检索 |
| `react` | ReAct 推理提示词 | 思考-行动-观察循环 |
| `custom` | 自定义提示词 | 其他场景 |

### 变量定义

变量定义支持以下属性：

```typescript
interface VariableDefinition {
  name: string;              // 变量名称
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';  // 变量类型
  required: boolean;         // 是否必填
  defaultValue?: any;        // 默认值
  description?: string;      // 变量描述
}
```

**示例**：

```json
[
  {
    "name": "basePrompt",
    "type": "string",
    "required": true,
    "description": "智能体的基础提示词"
  },
  {
    "name": "hasTools",
    "type": "boolean",
    "required": false,
    "defaultValue": false,
    "description": "是否有可用工具"
  },
  {
    "name": "tools",
    "type": "string",
    "required": false,
    "description": "工具描述"
  }
]
```

### 模板语法

系统使用 Handlebars 模板引擎，支持以下语法：

#### 1. 变量插值

```handlebars
你好，{{name}}！欢迎来到 {{platform}}。
```

#### 2. 条件渲染

```handlebars
{{#if hasTools}}
## 可用工具
{{tools}}
{{/if}}
```

#### 3. 循环渲染

```handlebars
{{#each items}}
- {{this.name}}: {{this.description}}
{{/each}}
```

#### 4. 注释

```handlebars
{{! 这是一个注释，不会出现在渲染结果中 }}
```

### 版本管理

#### 查看版本历史

```bash
GET /api/admin/prompt-template/{id}/versions
```

#### 版本回滚

```bash
POST /api/admin/prompt-template/{id}/rollback/{version}
{
  "changeLog": "回滚到版本 2，修复了提示词错误"
}
```

---

## API 接口文档

### 基础接口

#### 1. 创建模板

```http
POST /api/admin/prompt-template
Content-Type: application/json

{
  "name": "RAG问答提示词",
  "code": "rag-chat-default",
  "category": "rag",
  "content": "你是一个专业的问答助手...",
  "variables": [
    {
      "name": "context",
      "type": "string",
      "required": true,
      "description": "参考信息"
    }
  ],
  "isDefault": false,
  "status": true,
  "description": "RAG问答场景的提示词模板"
}
```

**响应**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "code": "rag-chat-default",
    "name": "RAG问答提示词",
    "category": "rag",
    "version": 1,
    "createdAt": "2026-05-09T00:00:00.000Z"
  }
}
```

#### 2. 更新模板

```http
PUT /api/admin/prompt-template/{code}
Content-Type: application/json

{
  "content": "更新后的提示词内容...",
  "changeLog": "优化了提示词结构"
}
```

#### 3. 删除模板

```http
DELETE /api/admin/prompt-template/{id}
```

#### 4. 查询模板列表

```http
GET /api/admin/prompt-template?page=1&pageSize=10&category=rag&status=true
```

**响应**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "uuid",
        "code": "rag-chat-default",
        "name": "RAG问答提示词",
        "category": "rag",
        "version": 1,
        "status": true,
        "createdAt": "2026-05-09T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

#### 5. 查询模板详情

```http
GET /api/admin/prompt-template/{id}
```

或

```http
GET /api/admin/prompt-template/code/{code}
```

### 渲染接口

#### 渲染模板

```http
POST /api/admin/prompt-template/render
Content-Type: application/json

{
  "code": "rag-chat-default",
  "variables": {
    "context": "参考信息内容...",
    "question": "用户问题..."
  }
}
```

**响应**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "renderedPrompt": "你是一个专业的问答助手。请根据以下参考信息回答用户问题。\n\n## 参考信息\n参考信息内容...\n\n## 用户问题\n用户问题...\n\n## 回答要求\n1. 基于参考信息准确回答\n2. 如果参考信息不足，请明确说明\n3. 使用友好、专业的语气"
  }
}
```

### 版本管理接口

#### 获取版本历史

```http
GET /api/admin/prompt-template/{id}/versions?limit=10
```

#### 版本回滚

```http
POST /api/admin/prompt-template/{id}/rollback/{version}
Content-Type: application/json

{
  "changeLog": "回滚原因说明"
}
```

---

## 集成指南

### 1. 智能体集成

智能体系统支持通过 `reasoningPrompt` 字段指定提示词模板。

#### 后端集成

智能体服务会自动根据推理模式选择模板：

```typescript
// agent.service.ts
let templateCode: string;
if (agent.reasoningPrompt) {
  templateCode = agent.reasoningPrompt;
} else {
  switch (agent.reasoningMode) {
    case 'REACT':
      templateCode = 'react-reasoning-default';
      break;
    case 'PLAN':
      templateCode = 'plan-reasoning-default';
      break;
    case 'REFLECT':
      templateCode = 'reflect-reasoning-default';
      break;
    default:
      templateCode = 'agent-system-default';
  }
}

const systemPrompt = await this.promptTemplateService.render(templateCode, {
  basePrompt: agent.systemPrompt || '你是一个有帮助的AI助手。',
  hasTools: tools.length > 0,
  tools: JSON.stringify(tools, null, 2)
});
```

#### 前端集成

智能体编辑页面提供模板选择功能：

```vue
<el-form-item label="推理提示词">
  <el-radio-group v-model="promptMode">
    <el-radio-button label="template">使用模板</el-radio-button>
    <el-radio-button label="custom">自定义输入</el-radio-button>
  </el-radio-group>

  <el-select v-if="promptMode === 'template'" v-model="selectedTemplateCode">
    <el-option
      v-for="template in promptTemplates"
      :key="template.code"
      :label="template.name"
      :value="template.code"
    />
  </el-select>

  <el-input v-else v-model="form.reasoningPrompt" type="textarea" />
</el-form-item>
```

### 2. RAG 问答集成

RAG 问答系统使用 `rag-chat-default` 模板。

#### 后端集成

```typescript
// retrieval.service.ts
const prompt = await this.promptTemplateService.render('rag-chat-default', {
  context: contextText,
  question: dto.question,
});
```

### 3. 技能调用集成

技能调用系统提供两个接口：

#### 渲染技能提示词

```typescript
// skill.controller.ts
@Post('render-prompt')
async renderPrompt(@Body() body: { skillCode: string; userRequest: string }) {
  const renderedPrompt = await this.skillService.renderSkillInvokePrompt(
    body.skillCode,
    body.userRequest,
  );
  return success({ renderedPrompt });
}
```

#### 智能选择技能

```typescript
// skill.controller.ts
@Post('select')
async selectSkill(
  @Body() body: { userRequest: string; availableSkills: string[] }
) {
  const result = await this.skillService.selectSkill(
    body.userRequest,
    body.availableSkills,
  );
  return success(result);
}
```

#### AI 模型集成

技能选择使用 AI 模型进行智能决策：

```typescript
// skill.service.ts
const result = await this.aiSdkProvider.generateText({
  model: defaultModel,
  system: systemPrompt,
  messages: [
    {
      role: 'user',
      content: userRequest,
    },
  ],
  temperature: 0.3,
});

const parsed = JSON.parse(result.text);
// 返回: { skillCode: 'get_weather', params: { city: '北京' }, reason: '选择理由' }
```

---

## 最佳实践

### 1. 模板命名规范

- **标识命名**：使用小写字母和连字符，格式为 `{场景}-{类型}-{描述}`
  - ✅ `rag-chat-default`
  - ✅ `react-reasoning-default`
  - ❌ `RAG_Chat_Default`

- **名称命名**：使用中文，简洁明了
  - ✅ `RAG问答提示词`
  - ✅ `ReAct推理提示词`

### 2. 变量设计原则

- **必填变量**：核心内容，如 `context`、`question`
- **可选变量**：增强功能，如 `hasTools`、`tools`
- **默认值**：为可选变量提供合理的默认值

```json
[
  {
    "name": "basePrompt",
    "type": "string",
    "required": true,
    "description": "基础提示词"
  },
  {
    "name": "hasTools",
    "type": "boolean",
    "required": false,
    "defaultValue": false,
    "description": "是否有工具"
  }
]
```

### 3. 模板内容设计

#### 结构化设计

```handlebars
{{! 1. 角色定义 }}
你是一个专业的问答助手。

{{! 2. 上下文信息 }}
## 参考信息
{{context}}

{{! 3. 用户输入 }}
## 用户问题
{{question}}

{{! 4. 任务要求 }}
## 回答要求
1. 基于参考信息准确回答
2. 如果参考信息不足，请明确说明
3. 使用友好、专业的语气
```

#### 条件渲染

```handlebars
{{#if hasTools}}
## 可用工具
{{tools}}

## 工具使用规则
当用户的问题需要使用工具来获取信息时，你必须调用相应的工具。
{{/if}}
```

### 4. 版本管理策略

- **重要变更**：记录详细的变更日志
- **版本回滚**：测试后再回滚，避免影响生产环境
- **版本命名**：使用语义化版本号（v1.0.0）

### 5. 性能优化

- **模板缓存**：频繁使用的模板建议缓存
- **变量验证**：渲染前验证变量，避免运行时错误
- **错误处理**：提供降级方案

```typescript
try {
  systemPrompt = await this.promptTemplateService.render(templateCode, variables);
} catch (error) {
  this.logger.warn(`Failed to render prompt template: ${templateCode}, fallback to default`);
  systemPrompt = defaultPrompt;
}
```

---

## 常见问题

### 1. 模板渲染失败

**问题**：提示词渲染时报错 `变量未定义`

**解决方案**：
- 检查变量定义是否完整
- 确保所有必填变量都已提供
- 为可选变量设置默认值

```typescript
// 错误示例
render('template-code', {});  // 缺少必填变量

// 正确示例
render('template-code', {
  requiredVar: 'value',
  optionalVar: 'value'  // 或使用默认值
});
```

### 2. 模板选择错误

**问题**：智能体使用了错误的模板

**解决方案**：
- 检查 `reasoningPrompt` 字段是否正确
- 确认模板标识是否存在
- 查看模板状态是否启用

### 3. 版本回滚失败

**问题**：版本回滚时报错

**解决方案**：
- 确认目标版本是否存在
- 检查模板 ID 是否正确
- 查看数据库连接状态

### 4. AI 模型选择不准确

**问题**：智能技能选择返回错误结果

**解决方案**：
- 优化系统提示词，提供更清晰的选择规则
- 降低温度参数（temperature: 0.3）提高稳定性
- 提供更详细的技能描述

### 5. 前端模板列表加载失败

**问题**：模板列表无法加载

**解决方案**：
- 检查 API 接口是否正常
- 确认查询参数格式正确
- 查看浏览器控制台错误信息

---

## 示例代码

### 1. 创建智能体提示词模板

```typescript
// 创建智能体系统提示词模板
const agentTemplate = {
  name: '智能体系统提示词',
  code: 'agent-system-default',
  category: 'agent',
  content: `{{basePrompt}}

{{#if hasTools}}
## 可用工具

{{tools}}

## 工具使用规则

当用户的问题需要使用工具来获取信息时，你必须调用相应的工具。
{{/if}}

## 回答要求

1. 准确回答用户问题
2. 使用友好、专业的语气
3. 如果不确定，请明确说明`,
  variables: [
    {
      name: 'basePrompt',
      type: 'string',
      required: true,
      description: '智能体的基础提示词'
    },
    {
      name: 'hasTools',
      type: 'boolean',
      required: false,
      defaultValue: false,
      description: '是否有可用工具'
    },
    {
      name: 'tools',
      type: 'string',
      required: false,
      description: '工具描述'
    }
  ],
  isDefault: true,
  status: true,
  description: 'Agent默认模式的系统提示词模板'
};

await promptTemplateApi.create(agentTemplate);
```

### 2. 使用模板渲染提示词

```typescript
// 渲染智能体系统提示词
const systemPrompt = await promptTemplateService.render('agent-system-default', {
  basePrompt: '你是一个天气助手，可以帮助用户查询天气信息。',
  hasTools: true,
  tools: JSON.stringify([
    {
      name: 'get_weather',
      description: '获取指定城市的天气信息',
      parameters: {
        city: { type: 'string', description: '城市名称' }
      }
    }
  ], null, 2)
});

console.log(systemPrompt);
// 输出:
// 你是一个天气助手，可以帮助用户查询天气信息。
//
// ## 可用工具
// [
//   {
//     "name": "get_weather",
//     "description": "获取指定城市的天气信息",
//     "parameters": {
//       "city": {
//         "type": "string",
//         "description": "城市名称"
//       }
//     }
//   }
// ]
//
// ## 工具使用规则
// 当用户的问题需要使用工具来获取信息时，你必须调用相应的工具。
//
// ## 回答要求
// 1. 准确回答用户问题
// 2. 使用友好、专业的语气
// 3. 如果不确定，请明确说明
```

### 3. 版本管理

```typescript
// 更新模板并记录变更
await promptTemplateApi.update('rag-chat-default', {
  content: '更新后的提示词内容...',
  changeLog: '优化了提示词结构，增加了回答要求'
});

// 查看版本历史
const versions = await promptTemplateApi.getVersionHistory(templateId, 10);

// 回滚到指定版本
await promptTemplateApi.rollback(templateId, 2, {
  changeLog: '回滚到版本 2，修复了提示词错误'
});
```

### 4. 前端集成示例

```vue
<template>
  <div class="prompt-template-manager">
    <el-button type="primary" @click="handleCreate">
      创建模板
    </el-button>

    <el-table :data="templates" v-loading="loading">
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="code" label="标识" />
      <el-table-column prop="category" label="分类" />
      <el-table-column prop="version" label="版本" />
      <el-table-column label="操作">
        <template #default="{ row }">
          <el-button size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button size="small" @click="handleRender(row)">渲染</el-button>
          <el-button size="small" @click="handleVersions(row)">版本</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { promptTemplateApi } from '@/api/prompt-template'

const templates = ref([])
const loading = ref(false)

const loadTemplates = async () => {
  loading.value = true
  try {
    const response = await promptTemplateApi.findAll({ pageSize: 100 })
    templates.value = response.data.data.list
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTemplates()
})
</script>
```

---

## 总结

提示词模板系统提供了完整的提示词管理解决方案，通过模板化、版本控制和智能集成，帮助开发者更好地管理和使用提示词。建议遵循最佳实践，合理设计模板结构和变量，以提高系统的可维护性和可扩展性。

如有问题或建议，请参考相关文档或联系开发团队。
