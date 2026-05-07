# 智能路由技术方案

## 📖 概述

### 什么是智能路由？

智能路由是当智能体绑定了多个知识库时，系统根据用户问题内容自动判断应该从哪些知识库检索，而不是盲目地从所有知识库检索的技术方案。

### 核心价值

**解决的问题：**

1. **提高准确性** - 避免检索不相关内容
2. **提升性能** - 减少不必要的检索操作
3. **改善体验** - 用户获得更精准的答案

**效果对比：**

```
❌ 不使用智能路由：
- 从 5 个知识库检索
- 返回 25 条结果
- 结果混乱，包含无关内容
- 响应时间长

✅ 使用智能路由：
- 从 1 个知识库检索
- 返回 5 条精准结果
- 相关性高，无干扰
- 响应速度快
```

---

## 🎯 应用场景

### 场景示例

```
智能体绑定了 5 个知识库：
1. kb_product（产品文档）
2. kb_tech（技术规范）
3. kb_faq（常见问题）
4. kb_legal（法律文档）
5. kb_training（培训材料）

用户问题："API 接口有什么要求？"

❌ 不使用智能路由：
- 从所有 5 个知识库检索
- 返回 25 条结果（每个知识库 5 条）
- 结果混乱，包含不相关内容
- 性能浪费

✅ 使用智能路由：
- 识别问题与技术相关
- 只从 kb_tech 检索
- 返回 5 条精准结果
- 性能高效
```

---

## 🏗️ 实现方案

### 方案对比

| 方案 | 准确度 | 速度 | 成本 | 复杂度 | 推荐度 |
|------|--------|------|------|--------|--------|
| 关键词匹配 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 免费 | ⭐⭐ | ⭐⭐⭐⭐ |
| 向量相似度 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 低 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| LLM 分类 | ⭐⭐⭐⭐⭐ | ⭐⭐ | 高 | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 混合路由 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 中 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 💻 方案详解

### 方案 1：关键词匹配

#### 原理

基于预定义的关键词规则，匹配问题内容，判断应该检索哪些知识库。

#### 实现代码

```typescript
/**
 * 知识库关键词配置
 */
interface KbKeywordConfig {
  kbCode: string;
  keywords: string[];
  priority: number;  // 优先级，数字越大优先级越高
}

/**
 * 关键词匹配智能路由
 */
export class KeywordRouter {
  private kbConfigs: KbKeywordConfig[] = [
    {
      kbCode: 'kb_product',
      keywords: ['产品', '功能', '使用', '操作', '如何使用', '怎么用'],
      priority: 1
    },
    {
      kbCode: 'kb_tech',
      keywords: ['技术', 'API', '接口', '开发', '代码', 'SDK', '集成'],
      priority: 2
    },
    {
      kbCode: 'kb_faq',
      keywords: ['问题', '错误', '怎么办', '如何', '为什么', '常见问题'],
      priority: 1
    },
    {
      kbCode: 'kb_legal',
      keywords: ['法律', '合规', '政策', '条款', '协议', '隐私'],
      priority: 3
    },
    {
      kbCode: 'kb_training',
      keywords: ['培训', '教程', '学习', '入门', '指南', '手册'],
      priority: 1
    }
  ];

  /**
   * 路由决策
   * @param query 用户问题
   * @param allowedKbs 允许访问的知识库列表
   * @returns 应该检索的知识库列表
   */
  route(query: string, allowedKbs: string[]): string[] {
    const scores: Map<string, number> = new Map();

    // 初始化分数
    allowedKbs.forEach(kb => scores.set(kb, 0));

    // 计算每个知识库的匹配分数
    for (const config of this.kbConfigs) {
      if (!allowedKbs.includes(config.kbCode)) continue;

      for (const keyword of config.keywords) {
        if (query.includes(keyword)) {
          const currentScore = scores.get(config.kbCode) || 0;
          scores.set(config.kbCode, currentScore + config.priority);
        }
      }
    }

    // 找出分数最高的知识库
    let maxScore = 0;
    const result: string[] = [];

    scores.forEach((score, kbCode) => {
      if (score > maxScore) {
        maxScore = score;
        result.length = 0;
        result.push(kbCode);
      } else if (score === maxScore && score > 0) {
        result.push(kbCode);
      }
    });

    // 如果没有匹配到任何关键词，返回所有知识库
    return result.length > 0 ? result : allowedKbs;
  }
}
```

#### 使用示例

```typescript
const router = new KeywordRouter();

// 示例 1：技术问题
const result1 = router.route('API接口有什么要求？', ['kb_product', 'kb_tech', 'kb_faq']);
console.log(result1); // ['kb_tech']

// 示例 2：产品问题
const result2 = router.route('产品怎么使用？', ['kb_product', 'kb_tech', 'kb_faq']);
console.log(result2); // ['kb_product']

// 示例 3：问题排查
const result3 = router.route('遇到错误怎么办？', ['kb_product', 'kb_tech', 'kb_faq']);
console.log(result3); // ['kb_faq']
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 实现简单 | ❌ 需要手动维护关键词 |
| ✅ 速度快 | ❌ 无法理解语义 |
| ✅ 可控性强 | ❌ 关键词冲突问题 |
| ✅ 无需模型 | ❌ 覆盖面有限 |

---

### 方案 2：向量相似度匹配

#### 原理

为每个知识库生成描述向量，将用户问题转换为向量，计算相似度，选择最相关的知识库。

#### 实现代码

```typescript
import { EmbeddingService } from '../embedding/embedding.service';

/**
 * 知识库描述配置
 */
interface KbDescription {
  kbCode: string;
  description: string;  // 知识库的详细描述
  tags: string[];       // 标签
}

/**
 * 向量相似度智能路由
 */
export class VectorRouter {
  private kbDescriptions: KbDescription[] = [
    {
      kbCode: 'kb_product',
      description: '产品使用文档，包含产品功能介绍、操作指南、使用说明等内容',
      tags: ['产品', '功能', '使用', '操作']
    },
    {
      kbCode: 'kb_tech',
      description: '技术文档，包含API接口文档、技术规范、开发指南、SDK文档等',
      tags: ['技术', 'API', '接口', '开发']
    },
    {
      kbCode: 'kb_faq',
      description: '常见问题解答，包含用户常见问题、故障排查、解决方案等',
      tags: ['问题', 'FAQ', '错误', '解决方案']
    },
    {
      kbCode: 'kb_legal',
      description: '法律文档，包含用户协议、隐私政策、合规条款等法律相关内容',
      tags: ['法律', '合规', '隐私', '协议']
    }
  ];

  private kbVectors: Map<string, number[]> = new Map();

  constructor(
    private readonly embeddingService: EmbeddingService
  ) {
    this.initializeKbVectors();
  }

  /**
   * 初始化知识库向量
   */
  private async initializeKbVectors() {
    for (const kb of this.kbDescriptions) {
      const text = `${kb.description} ${kb.tags.join(' ')}`;
      const vector = await this.embeddingService.embed(text);
      this.kbVectors.set(kb.kbCode, vector);
    }
  }

  /**
   * 路由决策
   */
  async route(query: string, allowedKbs: string[]): Promise<string[]> {
    // 1. 将问题转换为向量
    const queryVector = await this.embeddingService.embed(query);

    // 2. 计算与每个知识库的相似度
    const similarities: Array<{ kbCode: string; score: number }> = [];

    for (const kbCode of allowedKbs) {
      const kbVector = this.kbVectors.get(kbCode);
      if (!kbVector) continue;

      const score = this.cosineSimilarity(queryVector, kbVector);
      similarities.push({ kbCode, score });
    }

    // 3. 按相似度排序
    similarities.sort((a, b) => b.score - a.score);

    // 4. 选择相似度最高的知识库
    const threshold = 0.7;  // 相似度阈值
    const result: string[] = [];

    for (const item of similarities) {
      if (item.score >= threshold) {
        result.push(item.kbCode);
      }
    }

    // 如果没有超过阈值的知识库，返回前 2 个
    if (result.length === 0 && similarities.length > 0) {
      result.push(similarities[0].kbCode);
      if (similarities.length > 1) {
        result.push(similarities[1].kbCode);
      }
    }

    return result;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 语义理解能力强 | ❌ 需要向量模型 |
| ✅ 无需手动维护关键词 | ❌ 计算开销大 |
| ✅ 自动适应新知识库 | ❌ 初始化需要时间 |
| ✅ 准确度高 | ❌ 依赖模型质量 |

---

### 方案 3：LLM 分类

#### 原理

使用大语言模型（LLM）对用户问题进行分类，判断应该检索哪些知识库。

#### 实现代码

```typescript
import { LlmService } from '../llm/llm.service';

/**
 * LLM 智能路由
 */
export class LlmRouter {
  constructor(
    private readonly llmService: LlmService
  ) {}

  /**
   * 路由决策
   */
  async route(query: string, allowedKbs: string[]): Promise<string[]> {
    // 构建知识库描述
    const kbDescriptions = this.getKbDescriptions(allowedKbs);

    // 构建 Prompt
    const prompt = `你是一个知识库路由助手。根据用户的问题，判断应该从哪些知识库中检索信息。

可用的知识库：
${kbDescriptions}

用户问题：${query}

请返回应该检索的知识库代码列表，格式为 JSON 数组，例如：["kb_product", "kb_tech"]

只返回 JSON 数组，不要返回其他内容。`;

    // 调用 LLM
    const response = await this.llmService.chat({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个知识库路由助手，擅长根据问题内容判断应该检索哪些知识库。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 100
    });

    // 解析结果
    try {
      const result = JSON.parse(response.content);
      if (Array.isArray(result)) {
        // 验证结果是否在允许的知识库列表中
        return result.filter(kb => allowedKbs.includes(kb));
      }
    } catch (error) {
      console.error('解析 LLM 响应失败:', error);
    }

    // 解析失败，返回所有知识库
    return allowedKbs;
  }

  /**
   * 获取知识库描述
   */
  private getKbDescriptions(kbCodes: string[]): string {
    const descriptions = {
      'kb_product': 'kb_product: 产品文档，包含产品功能介绍、操作指南等',
      'kb_tech': 'kb_tech: 技术文档，包含API接口、技术规范、开发指南等',
      'kb_faq': 'kb_faq: 常见问题，包含用户常见问题、故障排查等',
      'kb_legal': 'kb_legal: 法律文档，包含用户协议、隐私政策等',
      'kb_training': 'kb_training: 培训材料，包含教程、学习指南等'
    };

    return kbCodes
      .map(code => descriptions[code] || code)
      .join('\n');
  }
}
```

#### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 理解能力最强 | ❌ 成本最高（API调用） |
| ✅ 可以处理复杂问题 | ❌ 响应慢 |
| ✅ 无需预定义规则 | ❌ 依赖 LLM 服务 |
| ✅ 可解释性强 | ❌ 可能出错 |

---

### 方案 4：混合路由（推荐）

#### 原理

结合多种方案，分层次进行路由决策，兼顾准确性和性能。

#### 实现代码

```typescript
/**
 * 混合智能路由
 */
export class HybridRouter {
  constructor(
    private readonly keywordRouter: KeywordRouter,
    private readonly vectorRouter: VectorRouter,
    private readonly llmRouter: LlmRouter
  ) {}

  /**
   * 路由决策
   */
  async route(query: string, allowedKbs: string[]): Promise<string[]> {
    // 第一层：关键词匹配（快速）
    const keywordResult = this.keywordRouter.route(query, allowedKbs);
    
    // 如果只匹配到一个知识库，且置信度高，直接返回
    if (keywordResult.length === 1) {
      return keywordResult;
    }

    // 第二层：向量相似度（中等速度）
    const vectorResult = await this.vectorRouter.route(query, allowedKbs);
    
    // 如果相似度高，返回向量结果
    if (vectorResult.length > 0 && vectorResult.length <= 2) {
      return vectorResult;
    }

    // 第三层：LLM 分类（慢但准确）
    // 只在复杂情况下使用
    if (this.isComplexQuery(query)) {
      return await this.llmRouter.route(query, allowedKbs);
    }

    // 默认：返回所有知识库
    return allowedKbs;
  }

  /**
   * 判断是否为复杂查询
   */
  private isComplexQuery(query: string): boolean {
    // 问题长度
    if (query.length > 50) return true;
    
    // 包含多个主题
    const topics = ['产品', '技术', '法律', '培训'];
    let topicCount = 0;
    for (const topic of topics) {
      if (query.includes(topic)) topicCount++;
    }
    if (topicCount > 1) return true;

    return false;
  }
}
```

#### 决策流程

```
用户问题
  ↓
关键词匹配
  ├─ 匹配成功（1个知识库）→ 返回结果 ✅
  └─ 匹配失败/多个知识库 ↓
向量相似度计算
  ├─ 相似度高（≤2个知识库）→ 返回结果 ✅
  └─ 相似度低/复杂问题 ↓
LLM 分类
  └─ 返回精准结果 ✅
```

---

## 🎯 最佳实践

### 推荐方案：关键词 + 向量相似度

```typescript
/**
 * 推荐的智能路由实现
 */
export class SmartRouter {
  private kbConfigs = [
    {
      kbCode: 'kb_product',
      keywords: ['产品', '功能', '使用'],
      description: '产品使用文档，包含产品功能介绍、操作指南等'
    },
    {
      kbCode: 'kb_tech',
      keywords: ['技术', 'API', '接口'],
      description: '技术文档，包含API接口、技术规范等'
    },
    {
      kbCode: 'kb_faq',
      keywords: ['问题', '错误', '怎么办'],
      description: '常见问题，包含用户常见问题、故障排查等'
    }
  ];

  constructor(
    private readonly embeddingService: EmbeddingService
  ) {}

  async route(query: string, allowedKbs: string[]): Promise<string[]> {
    // 1. 快速关键词匹配
    const keywordMatch = this.keywordMatch(query, allowedKbs);
    if (keywordMatch.length === 1) {
      return keywordMatch;
    }

    // 2. 向量相似度计算
    const vectorMatch = await this.vectorMatch(query, allowedKbs);
    
    // 3. 合并结果
    const result = this.mergeResults(keywordMatch, vectorMatch);
    
    return result.length > 0 ? result : allowedKbs;
  }

  /**
   * 关键词匹配
   */
  private keywordMatch(query: string, allowedKbs: string[]): string[] {
    const result: string[] = [];
    
    for (const config of this.kbConfigs) {
      if (!allowedKbs.includes(config.kbCode)) continue;
      
      for (const keyword of config.keywords) {
        if (query.includes(keyword)) {
          result.push(config.kbCode);
          break;
        }
      }
    }
    
    return result;
  }

  /**
   * 向量相似度匹配
   */
  private async vectorMatch(query: string, allowedKbs: string[]): Promise<string[]> {
    const queryVector = await this.embeddingService.embed(query);
    const similarities: Array<{ kbCode: string; score: number }> = [];

    for (const config of this.kbConfigs) {
      if (!allowedKbs.includes(config.kbCode)) continue;

      const kbVector = await this.embeddingService.embed(config.description);
      const score = this.cosineSimilarity(queryVector, kbVector);
      
      similarities.push({ kbCode: config.kbCode, score });
    }

    similarities.sort((a, b) => b.score - a.score);

    // 返回相似度最高的前 2 个
    return similarities
      .slice(0, 2)
      .filter(item => item.score > 0.6)
      .map(item => item.kbCode);
  }

  /**
   * 合并结果
   */
  private mergeResults(keywordResult: string[], vectorResult: string[]): string[] {
    const merged = new Set([...keywordResult, ...vectorResult]);
    return Array.from(merged);
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}
```

---

## 📋 知识库配置

### 配置示例

```typescript
const kbConfigs = [
  {
    kbCode: 'kb_product',
    name: '产品文档库',
    description: '产品使用文档，包含功能介绍、操作指南、使用说明',
    keywords: ['产品', '功能', '使用', '操作'],
    tags: ['产品', '用户指南'],
    priority: 1
  },
  {
    kbCode: 'kb_tech',
    name: '技术文档库',
    description: '技术文档，包含API接口、技术规范、开发指南',
    keywords: ['技术', 'API', '接口', '开发'],
    tags: ['技术', 'API', '开发'],
    priority: 2
  },
  {
    kbCode: 'kb_faq',
    name: '常见问题库',
    description: '常见问题解答，包含故障排查、解决方案',
    keywords: ['问题', '错误', '怎么办', '如何'],
    tags: ['FAQ', '问题'],
    priority: 1
  },
  {
    kbCode: 'kb_legal',
    name: '法律文档库',
    description: '法律文档，包含用户协议、隐私政策、合规条款',
    keywords: ['法律', '合规', '政策', '条款'],
    tags: ['法律', '合规'],
    priority: 3
  },
  {
    kbCode: 'kb_training',
    name: '培训材料库',
    description: '培训材料，包含教程、学习指南、培训文档',
    keywords: ['培训', '教程', '学习', '入门'],
    tags: ['培训', '教程'],
    priority: 1
  }
];
```

---

## 📊 效果评估

### 评估指标

```typescript
interface RoutingMetrics {
  accuracy: number;        // 准确率：正确路由的比例
  precision: number;       // 精确率：检索结果的相关性
  recall: number;          // 召回率：相关信息被检索到的比例
  avgResponseTime: number; // 平均响应时间（ms）
  costPerQuery: number;    // 每次查询成本（元）
}

// 目标值
const targetMetrics: RoutingMetrics = {
  accuracy: 0.90,          // ≥ 90%
  precision: 0.85,         // ≥ 85%
  recall: 0.90,            // ≥ 90%
  avgResponseTime: 200,    // ≤ 200ms
  costPerQuery: 0.001      // ≤ 0.001元
};
```

---

## 🚀 实施步骤

### 阶段 1：快速上线（1-2天）

```typescript
// 实现关键词匹配
function route(query: string, allowedKbs: string[]): string[] {
  // 关键词匹配逻辑
}
```

**目标：**
- ✅ 实现基础路由功能
- ✅ 满足基本需求
- ✅ 快速验证效果

---

### 阶段 2：优化体验（3-5天）

```typescript
// 添加向量相似度
async function route(query: string, allowedKbs: string[]): Promise<string[]> {
  // 关键词 + 向量混合
}
```

**目标：**
- ✅ 提高路由准确度
- ✅ 支持语义理解
- ✅ 优化用户体验

---

### 阶段 3：持续优化（长期）

- 收集用户反馈
- 调整关键词和描述
- 优化相似度阈值
- 添加新知识库配置

**目标：**
- ✅ 持续提升效果
- ✅ 适应业务变化
- ✅ 优化性能

---

## ❓ 常见问题

### Q1: 关键词冲突怎么办？

**解决方案：设置优先级**

```typescript
const kbConfigs = [
  {
    kbCode: 'kb_tech',
    keywords: ['API'],
    priority: 2  // 高优先级
  },
  {
    kbCode: 'kb_product',
    keywords: ['API'],
    priority: 1  // 低优先级
  }
];
```

---

### Q2: 向量相似度都很低怎么办？

**解决方案：设置阈值，未达标则返回所有**

```typescript
if (maxSimilarity < 0.6) {
  return allowedKbs;
}
```

---

### Q3: 如何处理多主题问题？

**解决方案：返回多个知识库**

```typescript
用户问："产品的API接口如何使用？"
→ 识别：产品 + API
→ 返回：["kb_product", "kb_tech"]
```

---

### Q4: 如何评估路由效果？

**解决方案：使用评估指标**

```typescript
// 准确率
accuracy = 正确路由数 / 总查询数

// 精确率
precision = 相关检索结果数 / 总检索结果数

// 召回率
recall = 检索到的相关信息数 / 总相关信息数
```

---

## 🎯 快速决策指南

### 场景选择

**场景 1：单一知识库**
→ 无需智能路由

**场景 2：2-3个知识库，内容差异大**
→ 关键词匹配即可

**场景 3：多个知识库，需要精准检索**
→ 向量相似度方案

**场景 4：复杂业务，高准确度要求**
→ 混合路由方案

---

## 📚 参考资料

- **向量相似度**：余弦相似度计算
- **关键词匹配**：字符串包含检查
- **LLM分类**：OpenAI Function Calling
- **混合路由**：分层决策策略

---

## 📝 总结

智能路由是提升知识库检索效果的关键技术：

1. **简单优先** - 先实现关键词匹配
2. **逐步优化** - 根据需求添加向量匹配
3. **合理配置** - 为知识库添加清晰描述
4. **持续监控** - 评估路由效果
5. **用户反馈** - 根据反馈优化配置

**推荐路径：**
关键词匹配 → 向量相似度 → 混合路由

智能路由让知识库检索更智能、更精准、更高效！🚀
