# 模型管理与参数模板使用指南

## 📖 目录

- [概述](#概述)
- [功能特性](#功能特性)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [模型管理](#模型管理)
- [参数模板](#参数模板)
- [API 接口文档](#api-接口文档)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)
- [示例代码](#示例代码)

---

## 概述

模型管理与参数模板系统是 AI 平台的核心基础设施，提供统一的模型配置管理和参数模板管理能力。通过标准化的配置方式，实现模型资源的规范化管理和灵活调度。

### 核心价值

- **统一管理**：集中管理所有 AI 模型配置
- **参数标准化**：通过模板管理模型参数，提高复用性
- **负载均衡**：支持基于权重的模型调度
- **场景优化**：针对不同场景提供优化的参数配置
- **资源监控**：实时监控模型使用情况

---

## 功能特性

### 1. 模型管理

- ✅ 模型注册与配置
- ✅ 多类型支持（LLM、Embedding、TTS、ASR、Image、LMM）
- ✅ 多提供商支持（OpenAI、Azure、阿里云、腾讯云、Ollama、Custom）
- ✅ 权重配置（负载均衡）
- ✅ 状态管理（启用/禁用）
- ✅ 标签分类（chat、reasoning、drawing、embedding、voice）
- ✅ 使用情况统计

### 2. 参数模板

- ✅ 模板创建与管理
- ✅ 参数配置（温度、TopP、上下文窗口、最大生成长度）
- ✅ 场景标签（客服问答、创意文案、向量生成、多模态、代码生成）
- ✅ 默认模板设置
- ✅ 模板复用

### 3. 调度策略

- ✅ 权重调度
- ✅ 随机调度
- ✅ 轮询调度
- ✅ 故障转移
- ✅ 熔断机制

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
│         (ModelService + ModelTemplateService)           │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                   数据持久层                             │
│              (Prisma + MySQL)                           │
└─────────────────────────────────────────────────────────┘
```

### 数据模型

#### 模型表（Model）

```prisma
model Model {
  id          String   @id @default(uuid())
  name        String   /// 模型名称
  code        String   @unique /// 模型唯一标识码
  type        String   /// 模型类型: llm / embedding / tts / asr / image / lmm / s2s
  provider    String   /// 提供商: openai / ollama / azure / aliyun / tencent / custom
  endpoint    String   /// 模型API地址
  apiKey      String?  /// API密钥
  weight      Int      @default(1) /// 权重(用于负载均衡)
  maxTokens   Int      @default(4096) /// 最大Token数
  temperature Float    @default(0.7) /// 温度参数
  status      Boolean  @default(true) /// 是否启用
  description String?  /// 模型描述
  config      String?  /// 额外配置(JSON格式)
  tags        String?  /// 模型标签(JSON数组)
  category    String?  /// 模型分类
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### 参数模板表（ModelTemplate）

```prisma
model ModelTemplate {
  id             String   @id @default(uuid())
  name           String   /// 模板名称
  code           String   @unique /// 模板唯一标识
  modelType      String   /// 适配模型类型: llm / embedding / lmm / s2s
  temperature    Float    @default(0.7) /// 温度参数(0-1)
  topP           Float    @default(0.7) /// 核采样参数(0-1)
  contextWindow  Int      @default(8192) /// 上下文窗口大小
  maxTokens      Int      @default(1000) /// 最大生成长度
  sceneTag       String?  /// 场景标签
  description    String?  /// 模板描述
  remark         String?  /// 备注
  isDefault      Boolean  @default(false) /// 是否为默认模板
  status         Boolean  @default(true) /// 是否启用
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

---

## 快速开始

### 1. 访问管理界面

启动前端服务后，访问模型配置中心：

```
http://localhost:5173/models
```

### 2. 添加第一个模型

点击"添加模型"按钮，填写以下信息：

- **名称**：GPT-4
- **标识**：gpt-4
- **类型**：LLM
- **提供商**：OpenAI
- **API 地址**：https://api.openai.com/v1
- **API 密钥**：sk-xxx
- **权重**：10
- **最大 Token 数**：8192
- **温度参数**：0.7
- **分类**：通用
- **标签**：chat、reasoning

### 3. 创建参数模板

切换到"参数模板"标签页，点击"新建模板"：

- **名称**：客服问答模板
- **标识**：customer-service-default
- **模型类型**：LLM
- **温度参数**：0.3
- **核采样参数**：0.8
- **上下文窗口**：8192
- **最大生成长度**：2000
- **场景标签**：客服问答
- **是否默认**：是

---

## 模型管理

### 模型类型

系统支持以下模型类型：

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| `llm` | 大语言模型 | 对话、推理、文本生成 |
| `embedding` | 向量模型 | 文本向量化、语义搜索 |
| `tts` | 语音合成模型 | 文本转语音 |
| `asr` | 语音识别模型 | 语音转文本 |
| `image` | 图像模型 | 图像生成、图像理解 |
| `lmm` | 大多模态模型 | 图文混合对话 |
| `s2s` | 端到端语音模型 | 语音对话、语音交互 |

### 提供商

系统支持以下提供商：

| 提供商 | 说明 | API 格式 |
|--------|------|----------|
| `openai` | OpenAI | OpenAI API |
| `azure` | Azure OpenAI | Azure OpenAI API |
| `aliyun` | 阿里云 | 通义千问 API |
| `tencent` | 腾讯云 | 混元 API |
| `ollama` | Ollama 本地部署 | Ollama API |
| `custom` | 自定义 | 自定义 API |

### 模型分类

| 分类 | 说明 | 适用场景 |
|------|------|----------|
| `general` | 通用模型 | 通用对话、问答 |
| `code` | 代码模型 | 代码生成、代码分析 |
| `math` | 数学模型 | 数学计算、推理 |
| `creative` | 创意模型 | 创意写作、内容创作 |
| `professional` | 专业模型 | 专业领域应用 |

### 模型标签

| 标签 | 说明 |
|------|------|
| `chat` | 对话能力 |
| `reasoning` | 推理能力 |
| `drawing` | 绘图能力 |
| `embedding` | 向量化能力 |
| `voice` | 语音能力 |

### 权重配置

权重用于负载均衡，权重越高被选中的概率越大：

```typescript
// 权重示例
const models = [
  { code: 'gpt-4', weight: 10 },      // 高权重，优先选择
  { code: 'gpt-3.5', weight: 5 },     // 中等权重
  { code: 'claude-3', weight: 3 },    // 低权重
];

// 权重计算
const totalWeight = models.reduce((sum, m) => sum + m.weight, 0); // 18
const probability = {
  'gpt-4': 10 / 18,      // 55.6%
  'gpt-3.5': 5 / 18,     // 27.8%
  'claude-3': 3 / 18,    // 16.7%
};
```

---

## 参数模板

### 参数说明

#### 1. 温度参数（Temperature）

控制模型输出的随机性，取值范围 0-1：

- **0.0 - 0.3**：低温度，输出更确定、精准
  - 适用场景：客服问答、技术文档、代码生成
  - 特点：答案稳定、一致性强

- **0.4 - 0.7**：中等温度，平衡创造性和准确性
  - 适用场景：通用对话、内容创作
  - 特点：既有创造性又保持准确

- **0.8 - 1.0**：高温度，输出更有创意、多样
  - 适用场景：创意写作、头脑风暴
  - 特点：创意性强、答案多样

#### 2. 核采样参数（TopP）

控制模型输出的多样性，取值范围 0-1：

- **0.5 - 0.7**：低多样性，输出更集中
- **0.7 - 0.9**：中等多样性，平衡多样性和质量
- **0.9 - 1.0**：高多样性，输出更发散

**建议**：通常固定为 0.7-0.9，通过温度参数调整输出特性

#### 3. 上下文窗口（Context Window）

模型可处理的最大输入 Token 数：

| 模型 | 上下文窗口 |
|------|-----------|
| GPT-3.5 | 4,096 |
| GPT-4 | 8,192 |
| GPT-4-32k | 32,768 |
| Claude-3 | 200,000 |
| Claude-3-Opus | 200,000 |

**注意**：上下文窗口越大，可处理的输入越长，但成本也越高

#### 4. 最大生成长度（Max Tokens）

模型单次输出的最大 Token 数：

- **短输出**：100-500 tokens
  - 适用场景：简单问答、摘要

- **中等输出**：500-2000 tokens
  - 适用场景：文章生成、代码生成

- **长输出**：2000+ tokens
  - 适用场景：长文写作、详细分析

### 场景标签

系统提供以下场景标签，每个场景有推荐的参数配置：

| 场景标签 | 标识 | 推荐温度 | 推荐TopP | 说明 |
|---------|------|---------|---------|------|
| 客服问答 | `customer_service` | 0.3 | 0.8 | 准确、一致的回答 |
| 创意文案 | `creative` | 0.8 | 0.9 | 创意性强、多样性高 |
| 向量生成 | `vector` | 0.0 | 1.0 | 确定的向量化结果 |
| 代码生成 | `code` | 0.2 | 0.8 | 准确的代码生成 |

### 默认模板

每个模型类型可以设置一个默认模板，系统会自动应用：

```typescript
// 设置默认模板
await modelTemplateApi.create({
  name: '客服问答默认模板',
  code: 'customer-service-default',
  modelType: 'llm',
  temperature: 0.3,
  topP: 0.8,
  contextWindow: 8192,
  maxTokens: 2000,
  sceneTag: 'customer_service',
  isDefault: true,  // 设置为默认模板
  status: true
});
```

---

## API 接口文档

### 模型管理接口

#### 1. 创建模型

```http
POST /api/admin/model
Content-Type: application/json

{
  "name": "GPT-4",
  "code": "gpt-4",
  "type": "llm",
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1",
  "apiKey": "sk-xxx",
  "weight": 10,
  "maxTokens": 8192,
  "temperature": 0.7,
  "status": true,
  "description": "OpenAI GPT-4 模型",
  "category": "general",
  "tags": ["chat", "reasoning"]
}
```

**响应**：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "code": "gpt-4",
    "name": "GPT-4",
    "type": "llm",
    "provider": "openai",
    "weight": 10,
    "createdAt": "2026-05-09T00:00:00.000Z"
  }
}
```

#### 2. 更新模型

```http
PUT /api/admin/model/{id}
Content-Type: application/json

{
  "weight": 15,
  "temperature": 0.5
}
```

#### 3. 删除模型

```http
DELETE /api/admin/model/{id}
```

**注意**：如果模型正在被知识库使用，将无法删除

#### 4. 查询模型列表

```http
GET /api/admin/model?type=llm&status=true&page=1&pageSize=10
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
        "code": "gpt-4",
        "name": "GPT-4",
        "type": "llm",
        "provider": "openai",
        "weight": 10,
        "status": true,
        "kbUsageCount": 5,
        "createdAt": "2026-05-09T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

#### 5. 获取可用模型列表

```http
GET /api/admin/model/available/{modelType}
```

**响应**：
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "uuid",
      "code": "gpt-4",
      "name": "GPT-4",
      "type": "llm",
      "provider": "openai"
    }
  ]
}
```

### 参数模板接口

#### 1. 创建模板

```http
POST /api/admin/model-template
Content-Type: application/json

{
  "name": "客服问答模板",
  "code": "customer-service-default",
  "modelType": "llm",
  "temperature": 0.3,
  "topP": 0.8,
  "contextWindow": 8192,
  "maxTokens": 2000,
  "sceneTag": "customer_service",
  "description": "适用于客服问答场景",
  "isDefault": true,
  "status": true
}
```

#### 2. 更新模板

```http
PUT /api/admin/model-template/{id}
Content-Type: application/json

{
  "temperature": 0.4,
  "maxTokens": 3000
}
```

#### 3. 删除模板

```http
DELETE /api/admin/model-template/{id}
```

#### 4. 查询模板列表

```http
GET /api/admin/model-template?modelType=llm&sceneTag=customer_service&page=1&pageSize=10
```

#### 5. 根据标识查询模板

```http
GET /api/admin/model-template/code/{code}
```

#### 6. 获取默认模板

```http
GET /api/admin/model-template/default/{modelType}
```

---

## 最佳实践

### 1. 模型配置建议

#### 生产环境配置

```typescript
{
  name: "GPT-4 Production",
  code: "gpt-4-prod",
  type: "llm",
  provider: "openai",
  endpoint: "https://api.openai.com/v1",
  weight: 10,              // 高权重
  maxTokens: 8192,         // 较大窗口
  temperature: 0.7,        // 中等温度
  status: true,            // 启用
  category: "general",
  tags: ["chat", "reasoning"]
}
```

#### 开发环境配置

```typescript
{
  name: "GPT-3.5 Dev",
  code: "gpt-3.5-dev",
  type: "llm",
  provider: "openai",
  endpoint: "https://api.openai.com/v1",
  weight: 5,               // 中等权重
  maxTokens: 4096,         // 标准窗口
  temperature: 0.7,
  status: true,
  category: "general",
  tags: ["chat"]
}
```

#### 本地模型配置

```typescript
{
  name: "Ollama Llama3",
  code: "llama3-local",
  type: "llm",
  provider: "ollama",
  endpoint: "http://localhost:11434",
  weight: 3,               // 低权重，作为备选
  maxTokens: 4096,
  temperature: 0.7,
  status: true,
  category: "general",
  tags: ["chat"]
}
```

### 2. 参数模板建议

#### 客服问答场景

```typescript
{
  name: "客服问答模板",
  code: "customer-service-default",
  modelType: "llm",
  temperature: 0.3,        // 低温度，确保答案准确
  topP: 0.8,
  contextWindow: 8192,
  maxTokens: 2000,         // 中等长度
  sceneTag: "customer_service",
  isDefault: true
}
```

#### 创意写作场景

```typescript
{
  name: "创意写作模板",
  code: "creative-writing",
  modelType: "llm",
  temperature: 0.8,        // 高温度，增加创意性
  topP: 0.9,
  contextWindow: 16384,    // 大窗口
  maxTokens: 4000,         // 长输出
  sceneTag: "creative",
  isDefault: false
}
```

#### 代码生成场景

```typescript
{
  name: "代码生成模板",
  code: "code-generation",
  modelType: "llm",
  temperature: 0.2,        // 低温度，确保代码准确
  topP: 0.8,
  contextWindow: 16384,    // 大窗口，支持长代码
  maxTokens: 4000,
  sceneTag: "code",
  isDefault: false
}
```

### 3. 权重配置策略

#### 高可用配置

```typescript
// 主模型 + 备用模型
const models = [
  { code: 'gpt-4', weight: 10, provider: 'openai' },      // 主模型
  { code: 'claude-3', weight: 8, provider: 'anthropic' }, // 备用模型
  { code: 'gpt-3.5', weight: 5, provider: 'openai' },     // 降级模型
];
```

#### 成本优化配置

```typescript
// 优先使用便宜模型
const models = [
  { code: 'gpt-3.5', weight: 10, provider: 'openai' },    // 便宜模型
  { code: 'llama3-local', weight: 8, provider: 'ollama' }, // 免费模型
  { code: 'gpt-4', weight: 3, provider: 'openai' },       // 昂贵模型
];
```

### 4. 安全建议

#### API 密钥管理

```typescript
// ❌ 不推荐：明文存储
{
  apiKey: "sk-xxxxxxxxxxxxx"
}

// ✅ 推荐：使用环境变量
{
  apiKey: process.env.OPENAI_API_KEY
}

// ✅ 推荐：使用密钥管理服务
{
  apiKey: await secretManager.get('openai-api-key')
}
```

#### 权限控制

```typescript
// 限制模型访问权限
const allowedModels = ['gpt-3.5', 'gpt-4'];
const model = await modelService.getModel(modelCode);

if (!allowedModels.includes(model.code)) {
  throw new ForbiddenException('无权访问该模型');
}
```

---

## 常见问题

### 1. 模型删除失败

**问题**：删除模型时报错"该模型正在被知识库使用"

**解决方案**：
- 检查知识库使用情况
- 先修改知识库的嵌入模型配置
- 再删除模型

```typescript
// 检查使用情况
const kbCount = await prisma.kbInfo.count({
  where: { 
    embeddingModel: model.code, 
    isDeleted: false 
  }
});

if (kbCount > 0) {
  throw new BadRequestException(
    `该模型正在被 ${kbCount} 个知识库使用，无法删除`
  );
}
```

### 2. 模型调用失败

**问题**：调用模型时报错"模型不可用"

**解决方案**：
- 检查模型状态是否启用
- 检查 API 密钥是否正确
- 检查网络连接是否正常
- 查看模型健康状态

### 3. 参数模板不生效

**问题**：设置了参数模板但模型调用时没有使用

**解决方案**：
- 检查模板状态是否启用
- 确认是否设置了默认模板
- 检查模板的模型类型是否匹配

### 4. 权重配置不生效

**问题**：配置了权重但模型选择不符合预期

**解决方案**：
- 检查权重值是否正确
- 确认模型状态是否启用
- 查看调度策略配置

### 5. 上下文窗口不足

**问题**：输入内容超过上下文窗口限制

**解决方案**：
- 选择更大上下文窗口的模型
- 对输入内容进行截断或摘要
- 使用分段处理策略

---

## 示例代码

### 1. 创建模型配置

```typescript
// 创建 OpenAI GPT-4 模型
const gpt4Model = {
  name: 'GPT-4',
  code: 'gpt-4',
  type: 'llm',
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
  weight: 10,
  maxTokens: 8192,
  temperature: 0.7,
  status: true,
  description: 'OpenAI GPT-4 模型',
  category: 'general',
  tags: ['chat', 'reasoning']
};

await modelApi.create(gpt4Model);
```

### 2. 创建参数模板

```typescript
// 创建客服问答模板
const customerServiceTemplate = {
  name: '客服问答模板',
  code: 'customer-service-default',
  modelType: 'llm',
  temperature: 0.3,
  topP: 0.8,
  contextWindow: 8192,
  maxTokens: 2000,
  sceneTag: 'customer_service',
  description: '适用于客服问答场景，确保答案准确一致',
  isDefault: true,
  status: true
};

await modelTemplateApi.create(customerServiceTemplate);
```

### 3. 获取可用模型

```typescript
// 获取所有可用的 LLM 模型
const availableModels = await modelApi.getAvailableModels('llm');

console.log('可用模型:', availableModels);
// 输出:
// [
//   { code: 'gpt-4', name: 'GPT-4', provider: 'openai' },
//   { code: 'gpt-3.5', name: 'GPT-3.5', provider: 'openai' },
//   { code: 'claude-3', name: 'Claude-3', provider: 'anthropic' }
// ]
```

### 4. 应用参数模板

```typescript
// 获取默认模板
const defaultTemplate = await modelTemplateApi.getDefaultTemplate('llm');

// 使用模板参数调用模型
const response = await aiService.generateText({
  model: selectedModel,
  messages: [{ role: 'user', content: '你好' }],
  temperature: defaultTemplate.temperature,
  topP: defaultTemplate.topP,
  maxTokens: defaultTemplate.maxTokens
});
```

### 5. 模型健康检查

```typescript
// 检查模型健康状态
const healthStatus = await modelService.checkHealth(modelId);

if (!healthStatus.healthy) {
  console.error('模型不健康:', healthStatus.errorMessage);
  // 切换到备用模型
  const fallbackModel = await modelService.getFallbackModel();
  return fallbackModel;
}
```

### 6. 前端集成示例

```vue
<template>
  <div class="model-manager">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="模型管理" name="models">
        <el-button type="primary" @click="handleAddModel">
          添加模型
        </el-button>

        <el-table :data="models" v-loading="loading">
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="code" label="标识" />
          <el-table-column prop="type" label="类型" />
          <el-table-column prop="provider" label="提供商" />
          <el-table-column prop="weight" label="权重" />
          <el-table-column prop="status" label="状态">
            <template #default="{ row }">
              <el-tag :type="row.status ? 'success' : 'danger'">
                {{ row.status ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button size="small" @click="handleEditModel(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDeleteModel(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="参数模板" name="templates">
        <el-button type="primary" @click="handleAddTemplate">
          新建模板
        </el-button>

        <el-table :data="templates" v-loading="templatesLoading">
          <el-table-column prop="name" label="模板名称" />
          <el-table-column prop="code" label="标识" />
          <el-table-column prop="modelType" label="模型类型" />
          <el-table-column prop="sceneTag" label="场景标签" />
          <el-table-column label="参数配置">
            <template #default="{ row }">
              <el-space wrap>
                <el-tag size="small">温度: {{ row.temperature }}</el-tag>
                <el-tag size="small">TopP: {{ row.topP }}</el-tag>
                <el-tag size="small">窗口: {{ row.contextWindow }}</el-tag>
                <el-tag size="small">最大: {{ row.maxTokens }}</el-tag>
              </el-space>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { modelApi, modelTemplateApi } from '@/api/model'

const activeTab = ref('models')
const models = ref([])
const templates = ref([])
const loading = ref(false)
const templatesLoading = ref(false)

const loadModels = async () => {
  loading.value = true
  try {
    const response = await modelApi.getList()
    models.value = response.data.data.list
  } finally {
    loading.value = false
  }
}

const loadTemplates = async () => {
  templatesLoading.value = true
  try {
    const response = await modelTemplateApi.findAll()
    templates.value = response.data.data.list
  } finally {
    templatesLoading.value = false
  }
}

onMounted(() => {
  loadModels()
  loadTemplates()
})
</script>
```

---

## 总结

模型管理与参数模板系统提供了完整的模型配置管理解决方案，通过标准化的配置方式和灵活的参数管理，帮助开发者更好地管理和使用 AI 模型。建议遵循最佳实践，合理配置模型参数和权重，以提高系统的性能和可靠性。

如有问题或建议，请参考相关文档或联系开发团队。
