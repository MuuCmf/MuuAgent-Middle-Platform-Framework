# 智能体模型路由调度机制

本文档描述智能体调用模型时的路由调度逻辑，包括意图识别、模型选择、参数合并等核心流程。

## 一、整体调用流程

```
用户输入 → 智能体获取 → 意图识别 → 模型路由调度 → 参数合并 → 模型推理 → 返回结果
```

## 二、核心流程详解

### 2.1 智能体获取

**文件位置**: `service/src/agent/agent.service.ts`

```typescript
// 根据ID或Code查询智能体
const agent = await this.prisma.agent.findFirst({ 
  where: { OR: [{ id: agentId }, { code: agentId }] } 
});

// 校验智能体状态
if (!agent.status) {
  throw new HttpException('智能体已禁用', HttpStatus.FORBIDDEN);
}
```

**关键检查项**:
- 智能体是否存在
- 智能体是否启用
- 应用隔离权限校验

### 2.2 意图识别

**文件位置**: `service/src/intent/intent.service.ts`

```typescript
// 根据用户消息分类意图
const intentResult = await this.intentClassifier.classify(userMessage);
const intent = intentResult.intent;
const intentModelType = this.intentClassifier.getModelTypeForIntent(intent);
```

**意图分类策略**:
1. **关键词匹配**（快速）: 基于预设关键词规则匹配
2. **AI分类**（兜底）: 使用LLM进行意图分类

**意图到模型类型映射**:

| 意图类型 | 模型类型 | 说明 |
|----------|----------|------|
| GENERAL | llm | 通用对话 |
| CODE | llm | 代码生成 |
| MATH | llm | 数学推理 |
| CREATIVE | llm | 创意写作 |
| PROFESSIONAL | llm | 专业问答 |
| IMAGE | image | 图像生成 |
| TTS | tts | 语音合成 |
| ASR | asr | 语音识别 |

### 2.3 模型路由调度

**文件位置**: `service/src/model-routing/model-routing.service.ts`

```typescript
if (dto.modelCode && dto.modelCode !== 'mcp') {
  // 客户端指定模型 → 验证能力后使用
  model = await this.mcpService.selectModelByIntent(intentModelType, intent, dto.modelCode);
} else {
  // 自动调度 → 选择最优模型
  model = await this.mcpService.selectModelByIntent(intentModelType, intent);
}
```

#### 路由调度流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                      模型路由调度流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 指定模型校验                                                  │
│     ├─ 有指定模型 → 校验能力 → 支持意图 → 直接返回                   │
│     └─ 不支持意图 → 进入自动调度（标记降级）                         │
│                                                                 │
│  2. 获取可用模型                                                  │
│     └─ modelService.getAvailableModels(modelType)               │
│                                                                 │
│  3. 按意图筛选                                                    │
│     └─ filterByIntent(models, intent, modelType)                │
│                                                                 │
│  4. 过滤熔断模型                                                  │
│     ├─ 检查 circuitStatus !== OPEN                              │
│     └─ 全部熔断 → 使用降级模型或兜底模型                            │
│                                                                 │
│  5. 按策略选择模型                                                │
│     ├─ WEIGHT (权重) → 按权重随机选择                             │
│     ├─ RANDOM (随机) → 随机选择                                  │
│     ├─ ROUND_ROBIN (轮询) → 依次选择                             │
│     └─ FAILOVER (故障转移) → 使用第一个可用模型                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 调度策略详解

| 策略 | 算法 | 适用场景 |
|------|------|----------|
| **WEIGHT** | 按权重随机选择，权重越高被选中概率越大 | 负载均衡，高配置模型承担更多流量 |
| **RANDOM** | 完全随机选择 | 简单场景，模型能力相近 |
| **ROUND_ROBIN** | 轮询选择，依次使用每个模型 | 流量均匀分配 |
| **FAILOVER** | 使用第一个可用模型 | 主备切换，优先使用主模型 |

**权重选择算法**:

```typescript
private selectByWeight(models: Model[]): Model {
  const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);
  let random = Math.random() * totalWeight;

  for (const model of models) {
    random -= model.weight;
    if (random <= 0) {
      return model;
    }
  }

  return models[0];
}
```

### 2.4 熔断机制

**文件位置**: `service/src/model-routing/model-routing.service.ts`

```typescript
// 熔断状态枚举
enum CircuitStatus {
  CLOSED = 'closed',       // 正常状态
  OPEN = 'open',           // 熔断状态（拒绝请求）
  HALF_OPEN = 'half_open', // 半开状态（尝试恢复）
}
```

**熔断配置参数**:

| 参数 | 默认值 | 说明 |
|------|--------|------|
| enableCircuit | true | 是否启用熔断 |
| circuitThreshold | 5 | 连续错误次数触发熔断 |
| circuitTimeout | 300000 | 熔断后恢复时间（毫秒） |
| fallbackModelId | - | 降级模型ID |

**熔断处理流程**:

1. 检查模型熔断状态
2. 过滤掉 `OPEN` 状态的模型
3. 若全部熔断，尝试使用降级模型
4. 若降级模型不可用，使用兜底模型（忽略熔断状态）

### 2.5 参数合并

**文件位置**: `service/src/common/utils/model-params.util.ts`

```typescript
// 参数优先级：调用参数 > 自定义参数 > 模板参数 > 系统默认值
const mergedParams = await this.getMergedModelParams(agent);
```

**参数合并逻辑**:

```typescript
export function mergeModelParams(sources: ModelParamsSource): ModelParams {
  const { callParams, templateParams, customParams } = sources;

  return {
    temperature:
      callParams?.temperature ??
      customParams?.temperature ??
      templateParams?.temperature ??
      SYSTEM_DEFAULTS.temperature,  // 0.7

    topP:
      callParams?.topP ??
      customParams?.topP ??
      templateParams?.topP ??
      SYSTEM_DEFAULTS.topP,  // 0.7

    maxTokens:
      callParams?.maxTokens ??
      customParams?.maxTokens ??
      templateParams?.maxTokens ??
      SYSTEM_DEFAULTS.maxTokens,  // 4096

    contextWindow:
      callParams?.contextWindow ??
      customParams?.contextWindow ??
      templateParams?.contextWindow ??
      SYSTEM_DEFAULTS.contextWindow,  // 8192
  };
}
```

**系统默认参数**:

| 参数 | 默认值 | 说明 |
|------|--------|------|
| temperature | 0.7 | 温度参数 |
| topP | 0.7 | 核采样参数 |
| maxTokens | 4096 | 最大生成Token数 |
| contextWindow | 8192 | 上下文窗口大小 |

## 三、完整调用链路图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              智能体对话请求                                   │
│                           POST /api/agent/chat                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. 获取智能体                                                                │
│     └─ getAgent(agentId) → 查询数据库，校验状态                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. 意图识别                                                                  │
│     ├─ 关键词匹配（快速）                                                      │
│     └─ AI分类（兜底）                                                         │
│     输出: intent = "code" | "creative" | "image" | ...                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. 模型路由调度                                                              │
│     ├─ 指定模型？ → 能力校验 → 通过/降级                                       │
│     ├─ 获取可用模型列表                                                       │
│     ├─ 按意图筛选                                                             │
│     ├─ 过滤熔断模型                                                           │
│     └─ 按策略选择（权重/随机/轮询/故障转移）                                    │
│     输出: model = { code, provider, endpoint, ... }                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. 参数合并                                                                  │
│     ├─ 获取模板参数（modelTemplateCode）                                       │
│     ├─ 解析自定义参数（customModelParams）                                     │
│     └─ 按优先级合并：调用 > 自定义 > 模板 > 默认                                │
│     输出: { temperature, topP, maxTokens, contextWindow }                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. 构建执行上下文                                                            │
│     ├─ 加载对话历史                                                           │
│     ├─ 加载工具（MCP Server / Skill）                                         │
│     ├─ 渲染系统提示词                                                         │
│     └─ 追加工作目录上下文                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. 模型推理                                                                  │
│     ├─ 调用 AI Service                                                       │
│     ├─ 执行 ReAct 循环（如启用）                                               │
│     └─ 流式/同步返回结果                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 四、关键配置项

### 4.1 路由策略配置

**数据库表**: `ModelRoutingStrategy`

| 字段 | 类型 | 说明 |
|------|------|------|
| modelType | string | 模型类型（llm, image, tts, asr等） |
| strategy | enum | 调度策略（weight/random/round_robin/failover） |
| retryCount | number | 重试次数 |
| timeout | number | 超时时间（毫秒） |
| fallbackModelId | string | 降级模型ID |
| enableCircuit | boolean | 是否启用熔断 |
| circuitThreshold | number | 熔断错误阈值 |
| circuitTimeout | number | 熔断恢复时间（毫秒） |

### 4.2 智能体模型配置

**数据库表**: `Agent`

| 字段 | 类型 | 说明 |
|------|------|------|
| modelTemplateCode | string | 绑定的模型模板标识 |
| customModelParams | text | 自定义模型参数（JSON格式） |

### 4.3 模型配置

**数据库表**: `Model`

| 字段 | 类型 | 说明 |
|------|------|------|
| weight | number | 权重值（权重调度时使用） |
| status | boolean | 是否启用 |
| provider | string | 模型提供商 |

## 五、路由日志

每次模型路由都会记录日志，用于分析和优化调度策略。

**日志字段**:

| 字段 | 说明 |
|------|------|
| userMessage | 用户消息 |
| detectedIntent | 检测到的意图 |
| confidence | 置信度 |
| source | 来源（specified/auto） |
| selectedModelId | 选中的模型ID |
| selectedModelCode | 选中的模型代码 |
| modelType | 模型类型 |
| isDegraded | 是否降级 |
| degradeReason | 降级原因 |
| costMs | 耗时（毫秒） |
| success | 是否成功 |
| errorMessage | 错误信息 |

## 六、最佳实践

### 6.1 调度策略选择

- **高可用场景**: 使用 `FAILOVER` 策略，配置主备模型
- **负载均衡场景**: 使用 `WEIGHT` 策略，按模型能力分配权重
- **流量均匀场景**: 使用 `ROUND_ROBIN` 策略

### 6.2 熔断配置建议

- 生产环境建议启用熔断
- `circuitThreshold` 建议设置为 3-5 次
- `circuitTimeout` 建议设置为 5-10 分钟
- 配置 `fallbackModelId` 作为降级方案

### 6.3 参数配置建议

- 使用模型模板统一管理参数
- 仅在特殊场景使用自定义参数
- 避免频繁修改参数

## 七、相关文件

| 文件 | 说明 |
|------|------|
| `service/src/agent/agent.service.ts` | 智能体服务，包含执行上下文构建 |
| `service/src/model-routing/model-routing.service.ts` | 模型路由调度核心服务 |
| `service/src/intent/intent.service.ts` | 意图分类服务 |
| `service/src/common/utils/model-params.util.ts` | 参数合并工具 |
| `service/src/model-routing/dto/model-routing.dto.ts` | 路由策略DTO定义 |
| `service/src/intent/dto/intent.dto.ts` | 意图DTO定义 |
