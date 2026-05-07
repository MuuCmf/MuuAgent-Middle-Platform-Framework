# 知识库检索功能使用文档

## 概述

知识库检索功能提供了基于向量数据库和BM25算法的智能文本检索能力，支持标准检索和RAG（Retrieval-Augmented Generation）增强对话两种模式。

## 知识库配置

### 检索方式配置

知识库支持两种检索方式，可在创建或编辑知识库时选择：

| 检索方式 | 说明 | 适用场景 |
|---------|------|---------|
| **向量检索** | 使用嵌入模型将文本转换为向量，基于向量相似度进行检索 | 需要语义理解的场景，如问答系统 |
| **BM25检索** | 使用BM25算法进行文本匹配，无需嵌入模型 | 嵌入服务不可用时的降级方案，关键词检索场景 |

### 配置参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `topN` | 返回的最大结果数 | 5 |
| `similarityThresh` | 相似度阈值（仅向量检索） | 0.7 |

## 检索API接口

### 1. 标准检索

**接口地址**: `POST /api/kb/retrieval`

**请求体**:

```json
{
  "kbId": "知识库ID",
  "query": "检索关键词",
  "topN": 5,
  "similarityThresh": 0.7
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "检索成功",
  "data": {
    "list": [
      {
        "chunkId": "文档切片ID",
        "content": "匹配的文本内容",
        "score": 0.85,
        "docId": "文档ID",
        "docName": "文档名称.md",
        "chunkIndex": 0
      }
    ],
    "total": 1,
    "costTime": 28,
    "cacheHit": false,
    "method": "vector"
  }
}
```

### 2. RAG对话（非流式）

**接口地址**: `POST /api/kb/chat/rag`

**请求体**:

```json
{
  "kbId": "知识库ID",
  "query": "用户问题",
  "topN": 5,
  "similarityThresh": 0.7,
  "uid": "用户标识（可选）"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "RAG问答成功",
  "data": {
    "answer": "基于知识库内容生成的回答",
    "sources": [
      {
        "chunkId": "切片ID",
        "content": "参考文档内容",
        "score": 0.85,
        "docId": "文档ID",
        "docName": "文档名称.md"
      }
    ],
    "retrievalCount": 2,
    "costTime": 1567
  }
}
```

### 3. RAG流式对话

**接口地址**: `POST /api/kb/chat/rag/stream`

**请求体**:

```json
{
  "kbId": "知识库ID",
  "query": "用户问题",
  "topN": 5,
  "similarityThresh": 0.7,
  "uid": "用户标识（可选）"
}
```

**响应格式**: Server-Sent Events (SSE)

**响应示例**:

```
data: {"sources":[{"content":"...","score":0.85,"docName":"文档.md"}]}
data: {"choices":[{"delta":{"content":"回答内容片段1"}}]}
data: {"choices":[{"delta":{"content":"回答内容片段2"}}]}
data: [DONE]
```

## 检索方式对比

### 向量检索

**优点**:
- 支持语义理解，能够理解上下文含义
- 对于同义词、近义词有较好的匹配效果
- 支持模糊查询

**缺点**:
- 依赖嵌入模型服务
- 需要向量数据库（Qdrant）支持
- 计算成本较高

**适用场景**:
- 智能问答系统
- 语义搜索
- 知识库问答

### BM25检索

**优点**:
- 无需嵌入模型，部署简单
- 计算速度快
- 不依赖外部服务

**缺点**:
- 基于关键词匹配，不理解语义
- 对于同义词效果较差

**适用场景**:
- 嵌入服务不可用时的降级方案
- 简单关键词检索
- 快速原型验证

## 降级策略

系统内置了智能降级策略：

1. **向量检索降级**: 当向量检索失败、使用随机向量或返回结果为空时，自动降级到BM25检索
2. **自适应阈值**: BM25检索使用动态计算的阈值，根据结果质量自动调整
3. **多重保障**: 确保在任何情况下都能返回有意义的结果

## 前端集成示例

### 标准检索

```javascript
import { retrievalApi } from '@/api/retrieval'

const result = await retrievalApi.retrieval({
  kbId: 'your-kb-id',
  query: '检索关键词',
  topN: 5,
  similarityThresh: 0.7
})
```

### RAG流式对话

```javascript
import { retrievalApi } from '@/api/retrieval'

await retrievalApi.ragChatStream(
  {
    kbId: 'your-kb-id',
    query: '用户问题',
    topN: 5,
    similarityThresh: 0.7
  },
  (content) => {
    // 流式接收回答内容
    console.log('收到内容:', content)
  },
  (error) => {
    console.error('错误:', error)
  },
  (sources) => {
    // 检索完成，获取参考来源
    console.log('参考来源:', sources)
  }
)
```

## 部署要求

### 向量检索模式

需要部署Qdrant向量数据库：

```yaml
# docker-compose.yml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - ./qdrant_data:/qdrant/storage
```

配置文件 `.env`:

```env
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=knowledge_base
```

### BM25检索模式

无需额外依赖，开箱即用。

## 日志说明

### 检索日志

系统会记录每次检索操作：

```json
{
  "kbId": "知识库ID",
  "query": "检索词",
  "topN": 5,
  "similarityThresh": 0.7,
  "retrievalCount": 2,
  "costTime": 28,
  "requestId": "唯一请求标识"
}
```

### 调试日志

设置日志级别为DEBUG可查看详细日志：

```bash
# 查看检索服务日志
[Retrieval] 知识库ID: xxx, 阈值: 0.7, topN: 5
[Retrieval] 已完成的文档数: 10
[Retrieval] 已向量化的切片数: 100
[Retrieval] 使用配置的BM25检索模式
[BM25Service] BM25索引构建完成: 100 个文档, 5000 个词项
```

## 最佳实践

### 1. 知识库文档管理

- 建议将大文档拆分为多个小文档（500-1000字/篇）
- 使用清晰的标题和目录结构
- 定期更新和维护知识库内容

### 2. 检索参数调优

- `topN`: 根据实际需求调整，建议值为3-10
- `similarityThresh`: 
  - 向量检索：0.5-0.9，值越高结果越精确但可能返回空
  - BM25：使用自适应阈值，无需手动调整

### 3. 性能优化

- 启用缓存机制减少重复检索
- 定期重建BM25索引
- 对于大规模知识库，考虑使用向量检索

## 故障排查

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 向量检索返回空 | 向量数据库未创建集合 | 上传文档触发自动创建 |
| BM25检索返回空 | 索引未构建 | 上传文档后自动构建 |
| 相似度分数低 | 嵌入模型质量问题 | 检查嵌入模型配置 |
| 流式响应中断 | 网络超时 | 增加超时时间配置 |

### 调试方法

1. **查看后端日志**：检查检索服务日志确认检索流程
2. **验证API接口**：使用curl或Postman测试检索接口
3. **检查数据库状态**：确认知识库和文档数据已正确存储

## 附录

### 响应状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 404 | 知识库不存在或未启用 |
| 500 | 服务器内部错误 |

### 错误信息

```json
{
  "code": 404,
  "message": "知识库不存在或未启用",
  "timestamp": "2024-01-01T12:00:00Z"
}
```
