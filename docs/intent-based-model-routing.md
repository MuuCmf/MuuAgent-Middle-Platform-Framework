# 服务端MCP调度 - 根据对话意图调用不同类型模型

## 1. 需求概述

### 1.1 核心需求

在现有 MCP 调度基础上，增加**根据对话意图自动选择合适类型模型**的能力。例如：

- 用户问编程问题 → 自动路由到 `code` 分类的模型（如 DeepSeek-Coder）
- 用户问数学问题 → 自动路由到 `math` 分类的模型
- 用户要求生图 → 自动路由到 `image` 类型的模型
- 用户要求语音合成 → 自动路由到 `tts` 类型的模型

### 1.2 附加需求

当用户**指定了具体模型**，但该模型不具备所需能力时（如指定了一个纯文本 LLM 去做生图），系统应**自动降级为 MCP 智能调度**，选择具备该能力的模型。

### 1.3 预期效果

```
当前流程：
用户消息 → 按 modelType(llm) 调度 → 随机/权重选一个 LLM → 返回结果

目标流程：
用户消息 → 意图识别 → 按 意图+modelType 调度 → 选择匹配的模型 → 返回结果
                ↓
        意图: code → 筛选 category=code 的模型 → 调度
        意图: math → 筛选 category=math 的模型 → 调度
        意图: image → 切换 modelType=image → 调度
```

---

## 2. 当前架构分析

### 2.1 模型选择调用链

```
客户端 ModelSelector.vue
  │
  ├─ 选择 "MCP智能调度" (modelCode = undefined / 'mcp-llm')
  │   └─ AiService.selectModel(undefined, 'llm')
  │       └─ McpService.selectModel('llm')
  │           ├─ ModelService.getAvailableModels('llm')  // 按 type=llm 查所有启用模型
  │           ├─ 过滤熔断模型
  │           └─ 按策略(weight/random/round_robin/failover)选一个
  │
  └─ 选择指定模型 (modelCode = 'gpt-4')
      └─ AiService.selectModel('gpt-4', 'llm')
          └─ ModelService.findByCode('gpt-4')  // 直接返回指定模型
```

### 2.2 关键文件

| 文件 | 职责 |
|------|------|
| `service/src/mcp/mcp.service.ts` | MCP 调度核心：模型选择、熔断、限流 |
| `service/src/ai/ai.service.ts` | AI 统一调用服务：`selectModel()`、`invoke()`、`streamInvoke()` |
| `service/src/agent/agent.service.ts` | 智能体服务：`buildExecutionContext()` 中决定模型 |
| `service/src/model/model.service.ts` | 模型 CRUD：`getAvailableModels()`、`findByCode()` |
| `service/prisma/schema.prisma` | 数据模型定义 |

### 2.3 现有模型字段（可复用）

```prisma
model Model {
  type     String   // llm / embedding / tts / asr / image / multimodal
  tags     String?  // JSON数组: ["chat", "reasoning", "drawing", "embedding", "voice"]
  category String?  // general / code / math / creative / professional
}
```

### 2.4 现有意图相关能力

- **技能智能选择**（`skill.service.ts:selectSkill()`）：已实现用 AI 根据用户请求选择最合适技能，可作为意图识别的参考实现
- **推理模式**（`ReasoningMode`）：NONE / REACT / PLAN / REFLECT，智能体级别配置
- **智能路由文档**（`docs/smart-routing.md`）：知识库智能路由方案，含关键词匹配、向量相似度、LLM 分类三种方案

---

## 3. 设计方案

### 3.1 意图分类体系

复用并扩展模型已有的 `category` 和 `tags` 字段，建立意图到模型能力的映射：

| 意图分类 | 对应 model.category | 对应 model.type | 触发条件（示例） |
|----------|---------------------|-----------------|------------------|
| 通用对话 | `general` | `llm` | 闲聊、一般问答 |
| 编程开发 | `code` | `llm` | 写代码、Debug、代码审查 |
| 数学计算 | `math` | `llm` | 数学题、公式推导 |
| 创意写作 | `creative` | `llm` | 写文章、写诗、故事创作 |
| 专业领域 | `professional` | `llm` | 法律、医疗、金融咨询 |
| 图像生成 | — | `image` | 画图、生成图片 |
| 语音合成 | — | `tts` | 文字转语音 |
| 语音识别 | — | `asr` | 语音转文字 |
| 多模态理解 | — | `multimodal` | 图片理解、视频分析 |

### 3.2 意图识别策略（混合方案）

采用**关键词快速匹配 + AI 兜底**的混合策略：

```
用户消息
  │
  ├─ 第1层：关键词/规则匹配（0ms，免费）
  │   ├─ 匹配到明确意图 → 直接使用
  │   └─ 未匹配 → 进入第2层
  │
  └─ 第2层：AI 意图分类（~500ms，低成本）
      └─ 用小模型做意图分类 → 返回意图标签
```

#### 第1层：关键词规则匹配

```typescript
// 意图关键词映射配置
const INTENT_KEYWORDS: Record<string, string[]> = {
  code: ['代码', '编程', 'bug', '函数', '算法', 'API', 'debug', '报错', '异常'],
  math: ['计算', '数学', '公式', '方程', '几何', '概率', '统计'],
  image: ['画', '生成图片', '绘图', '图片', '插图', '海报'],
  tts: ['朗读', '语音', '合成语音', '文字转语音', '播报'],
  // ...
};
```

#### 第2层：AI 意图分类

复用 `skill.service.ts:selectSkill()` 的模式，用小模型做分类：

```typescript
// 意图分类 Prompt
const INTENT_CLASSIFY_PROMPT = `分析用户消息的意图，返回以下分类之一：
- general: 通用对话
- code: 编程开发
- math: 数学计算
- creative: 创意写作
- image: 图像生成
- tts: 语音合成

只返回分类标签，不要其他内容。`;

// 调用小模型分类
const result = await aiService.generateText({
  model: cheapModel,  // 使用便宜/快速的小模型
  system: INTENT_CLASSIFY_PROMPT,
  messages: [{ role: 'user', content: userMessage }],
  temperature: 0.1,
  maxTokens: 10,
});
```

### 3.3 模型-意图映射与调度流程

#### 改造后的调度流程

```
MCP调度请求
  │
  ├─ 有 modelCode（用户指定了模型）
  │   ├─ 检查指定模型是否具备所需能力
  │   │   ├─ 具备 → 直接使用指定模型
  │   │   └─ 不具备 → 降级为自动调度（按意图选择）
  │   │
  │   └─ 能力检查规则：
  │       - modelType=llm 的模型：检查 category 是否匹配意图
  │       - modelType=image 的模型：只能处理 image 意图
  │       - modelType=tts 的模型：只能处理 tts 意图
  │
  └─ 无 modelCode（MCP智能调度）
      └─ 意图识别 → 筛选匹配模型 → 调度策略选择
```

#### 模型筛选逻辑

```typescript
async selectModelByIntent(
  modelType: string,    // 'llm' | 'image' | 'tts' | ...
  intent: string,       // 'code' | 'math' | 'general' | ...
  specifiedModelCode?: string  // 用户指定的模型代码
): Promise<Model> {
  // 1. 如果用户指定了模型，先验证能力
  if (specifiedModelCode) {
    const model = await this.modelService.findByCode(specifiedModelCode);
    if (this.modelSupportsIntent(model, intent, modelType)) {
      return model;  // 指定模型具备能力，直接使用
    }
    // 不具备能力，降级为自动调度
    console.warn(`指定模型 ${specifiedModelCode} 不支持意图 ${intent}，降级为自动调度`);
  }

  // 2. 获取可用模型列表
  let models = await this.modelService.getAvailableModels(modelType);

  // 3. 按意图筛选模型
  if (modelType === 'llm') {
    // LLM 类型按 category 筛选
    models = models.filter(m => 
      !m.category || m.category === 'general' || m.category === intent
    );
    // 如果没有精确匹配，回退到 general 分类
    if (models.length === 0) {
      models = await this.modelService.getAvailableModels(modelType);
    }
  }

  // 4. 过滤熔断模型
  // 5. 按调度策略选择（复用现有 weight/random/round_robin）
  // ...
}
```

### 3.4 能力匹配规则

```typescript
/**
 * 检查模型是否支持指定意图
 */
function modelSupportsIntent(model: Model, intent: string, modelType: string): boolean {
  // image/tts/asr 类型：意图必须与模型类型匹配
  if (['image', 'tts', 'asr', 'embedding'].includes(modelType)) {
    return model.type === modelType;
  }

  // llm/multimodal 类型：检查 category 匹配
  if (modelType === 'llm' || modelType === 'multimodal') {
    // general 分类的模型支持所有意图
    if (!model.category || model.category === 'general') return true;
    // 精确匹配
    return model.category === intent;
  }

  return true;
}
```

---

## 4. 数据库变更

### 4.1 新增表：意图分类缓存（可选）

```prisma
/// 意图分类缓存表 - 缓存用户消息的意图分类结果
model IntentCache {
  id          BigInt   @id @default(0)
  messageHash String   @unique /// 消息内容哈希（MD5）
  intent      String   /// 分类结果: general/code/math/creative/image/tts
  confidence  Float    @default(1.0) /// 置信度 0-1
  source      String   @default("ai") /// 分类来源: keyword/ai
  hitCount    Int      @default(1) /// 命中次数
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([messageHash])
  @@map("intent_cache")
}
```

### 4.2 现有表变更

**无需变更**。现有 `Model` 表的 `category` 和 `tags` 字段已满足需求。

---

## 5. 新增/变更模块

### 5.1 新增：意图分类服务 `IntentClassifierService`

```
service/src/intent/
  ├── intent.module.ts          // 意图分类模块
  ├── intent.service.ts         // 意图分类核心服务
  ├── intent.keywords.ts        // 关键词规则配置
  └── dto/
      └── intent.dto.ts         // 意图分类 DTO
```

#### 核心接口

```typescript
// intent.service.ts

/**
 * 意图分类服务
 * 采用关键词快速匹配 + AI兜底的混合策略
 */
@Injectable()
export class IntentClassifierService {
  /**
   * 分类用户消息的意图
   * @param message 用户消息内容
   * @param useAI 是否启用AI分类（默认true）
   * @returns 意图分类结果
   */
  async classify(message: string, useAI: boolean = true): Promise<IntentResult> {
    // 1. 检查缓存
    const cached = await this.getFromCache(message);
    if (cached) return cached;

    // 2. 关键词匹配
    const keywordResult = this.matchByKeywords(message);
    if (keywordResult.confidence >= 0.8) {
      await this.saveToCache(message, keywordResult);
      return keywordResult;
    }

    // 3. AI分类（如果启用）
    if (useAI) {
      const aiResult = await this.classifyByAI(message);
      await this.saveToCache(message, aiResult);
      return aiResult;
    }

    // 4. 默认返回 general
    return { intent: 'general', confidence: 0.5, source: 'default' };
  }
}
```

### 5.2 变更：MCP调度服务 `McpService`

新增方法：

```typescript
// mcp.service.ts 新增

/**
 * 根据意图选择最优模型
 * @param modelType 模型技术类型
 * @param intent 对话意图
 * @param specifiedModelCode 用户指定的模型代码（可选）
 * @returns 选中的模型
 */
async selectModelByIntent(
  modelType: string,
  intent: string,
  specifiedModelCode?: string,
): Promise<Model> {
  // 1. 指定模型能力校验
  if (specifiedModelCode) {
    const model = await this.modelService.findByCode(specifiedModelCode);
    if (this.modelSupportsIntent(model, intent, modelType)) {
      return model;
    }
    // 降级：记录日志后走自动调度
    this.logger.warn(`指定模型 ${specifiedModelCode} 不支持意图 ${intent}，降级为自动调度`);
  }

  // 2. 获取可用模型
  const strategy = await this.getStrategy(modelType);
  let models = await this.modelService.getAvailableModels(modelType);

  // 3. 按意图筛选
  models = this.filterByIntent(models, intent, modelType);

  if (!models.length) {
    // 回退：使用所有可用模型
    models = await this.modelService.getAvailableModels(modelType);
  }

  if (!models.length) {
    throw new HttpException('无可用模型', HttpStatus.SERVICE_UNAVAILABLE);
  }

  // 4. 过滤熔断模型
  // 5. 按策略选择（复用现有逻辑）
  // ...
}
```

### 5.3 变更：AI服务 `AiService`

修改 `selectModel()` 方法，增加意图参数：

```typescript
// ai.service.ts 变更

private async selectModel(
  modelCode?: string,
  modelType?: string,
  intent?: string,  // 新增：对话意图
): Promise<Model> {
  if (modelCode) {
    // 指定了模型，需要验证能力
    if (intent) {
      return this.mcpService.selectModelByIntent(
        modelType || 'llm',
        intent,
        modelCode,
      );
    }
    return this.modelService.findByCode(modelCode);
  }
  // MCP智能调度
  if (intent) {
    return this.mcpService.selectModelByIntent(modelType || 'llm', intent);
  }
  return this.mcpService.selectModel(modelType || 'llm');
}
```

### 5.4 变更：智能体服务 `AgentService`

在 `buildExecutionContext()` 中增加意图识别步骤：

```typescript
// agent.service.ts buildExecutionContext() 变更

private async buildExecutionContext(...) {
  // ... 现有逻辑 ...

  // 新增：意图识别
  const intent = await this.intentClassifier.classify(dto.message);

  // 模型选择（传入意图）
  if (dto.modelCode && dto.modelCode !== 'mcp') {
    model = await this.mcpService.selectModelByIntent('llm', intent, dto.modelCode);
  } else {
    model = await this.mcpService.selectModelByIntent('llm', intent);
  }

  // ... 后续逻辑 ...
}
```

---

## 6. 接口设计

### 6.1 管理端 API

#### 获取意图分类配置

```
GET /api/admin/mcp/intent-config
Response: {
  code: 0,
  data: {
    enabled: true,
    aiFallback: true,
    keywordRules: [...],
    intentModelMapping: {...}
  }
}
```

#### 更新意图分类配置

```
PUT /api/admin/mcp/intent-config
Body: {
  enabled: true,
  aiFallback: true,
  keywordRules: [
    { intent: "code", keywords: ["代码", "编程", "bug"] }
  ]
}
```

### 6.2 业务端 API（无需变更）

现有的 AI 调用接口无需变更，意图识别在服务端内部完成，对调用方透明。

---

## 7. 实现步骤

### 第一阶段：基础设施（1-2天）

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 1.1 | 创建 `IntentCache` 数据库表 | `prisma/schema.prisma` |
| 1.2 | 运行 `db:sync` 同步数据库 | — |
| 1.3 | 创建 `IntentClassifierService` 关键词匹配 | `service/src/intent/` |
| 1.4 | 创建意图分类 DTO | `service/src/intent/dto/` |
| 1.5 | 创建 `IntentModule` 并注册 | `service/src/intent/intent.module.ts` |

### 第二阶段：核心调度改造（2-3天）

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 2.1 | `McpService` 新增 `selectModelByIntent()` | `mcp.service.ts` |
| 2.2 | `McpService` 新增 `modelSupportsIntent()` | `mcp.service.ts` |
| 2.3 | `McpService` 新增 `filterByIntent()` | `mcp.service.ts` |
| 2.4 | `AiService.selectModel()` 增加 intent 参数 | `ai.service.ts` |
| 2.5 | `AiService.invoke()` 集成意图识别 | `ai.service.ts` |
| 2.6 | `AiService.streamInvoke()` 集成意图识别 | `ai.service.ts` |

### 第三阶段：智能体集成（1天）

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 3.1 | `AgentService.buildExecutionContext()` 集成意图识别 | `agent.service.ts` |
| 3.2 | 指定模型能力校验 + 降级逻辑 | `agent.service.ts` |

### 第四阶段：AI 意图分类（1-2天）

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 4.1 | 实现 `classifyByAI()` 方法 | `intent.service.ts` |
| 4.2 | 意图分类 Prompt 模板 | `intent.service.ts` |
| 4.3 | 缓存机制（避免重复分类） | `intent.service.ts` |

### 第五阶段：管理端配置（1天）

| 步骤 | 内容 | 涉及文件 |
|------|------|----------|
| 5.1 | 意图分类配置 CRUD API | `mcp.controller.ts` |
| 5.2 | 管理端配置页面 | `admin/src/views/mcp/` |

### 第六阶段：测试与优化（1-2天）

| 步骤 | 内容 |
|------|------|
| 6.1 | 单元测试：关键词匹配、AI分类、模型筛选 |
| 6.2 | 集成测试：端到端意图路由 |
| 6.3 | 性能测试：意图分类延迟 |
| 6.4 | 降级场景测试：指定模型不支持意图时 |

---

## 8. 关键设计决策

### 8.1 为什么用混合方案而不是纯 AI？

| 方案 | 延迟 | 成本 | 准确率 | 维护成本 |
|------|------|------|--------|----------|
| 纯关键词 | 0ms | 免费 | 70% | 中（需维护关键词） |
| 纯 AI | ~500ms | 每次约 $0.001 | 95% | 低 |
| **混合方案** | **0-500ms** | **低频 $0.001** | **90%** | **中** |

混合方案在 80% 场景下走关键词（0延迟），20% 模糊场景走 AI（高准确率）。

### 8.2 为什么缓存意图分类结果？

同一会话中，用户意图通常不变。对消息内容做哈希缓存，避免重复分类。

### 8.3 降级策略

```
正常: 关键词匹配 → 命中 → 筛选模型 → 调度
      AI分类     → 命中 → 筛选模型 → 调度

降级1: 意图筛选后无可用模型 → 回退到所有可用模型
降级2: 意图分类失败 → 默认 general → 所有 LLM 模型
降级3: 指定模型不支持意图 → 自动切换为 MCP 调度
```

---

## 9. 风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 意图分类错误 | 选错模型，回答质量下降 | 保留 `general` 兜底；可手动指定模型绕过 |
| AI 分类增加延迟 | 用户体验下降 | 关键词优先；缓存结果；使用快速小模型 |
| 模型分类标签不准确 | 筛选结果不理想 | 管理端提供分类标签编辑功能 |
| 指定模型降级 | 用户困惑为何没用指定模型 | 日志记录；前端提示（可选） |

---

## 10. 附录

### A. 关键词规则配置示例

```typescript
export const DEFAULT_INTENT_KEYWORDS: Record<string, { keywords: string[]; weight: number }> = {
  code: {
    keywords: ['代码', '编程', 'bug', '函数', '算法', 'API', 'debug', '报错', '异常', '重构', '优化', '性能'],
    weight: 1,
  },
  math: {
    keywords: ['计算', '数学', '公式', '方程', '几何', '概率', '统计', '微积分', '线性代数'],
    weight: 1,
  },
  creative: {
    keywords: ['写文章', '写诗', '故事', '创作', '文案', '广告语', '小说', '剧本'],
    weight: 1,
  },
  image: {
    keywords: ['画', '生成图片', '绘图', '图片', '插图', '海报', '生成图', '画一张'],
    weight: 2,
  },
  tts: {
    keywords: ['朗读', '语音合成', '文字转语音', '播报', '配音', '读出来'],
    weight: 2,
  },
};
```

### B. AI 意图分类 Prompt

```
你是一个对话意图分类器。分析用户消息，返回以下分类之一：

分类列表：
- general: 通用对话、闲聊、一般问答
- code: 编程开发、代码编写、Debug、技术问题
- math: 数学计算、公式推导、数值分析
- creative: 创意写作、文案创作、内容生成
- image: 图像生成、图片创作、绘图需求
- tts: 语音合成、文字转语音

规则：
1. 只返回分类标签，不要其他内容
2. 如果无法确定，返回 general
3. 优先匹配明确的意图信号

示例：
"帮我写一个排序算法" → code
"计算圆的面积" → math
"帮我画一张风景图" → image
"今天天气怎么样" → general
```