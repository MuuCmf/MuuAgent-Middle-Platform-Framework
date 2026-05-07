# Qdrant 向量数据库配置与使用文档

## 概述

Qdrant 是一个开源的向量数据库，用于存储、管理和检索高维向量数据。本项目使用 Qdrant 作为知识库检索功能的底层向量存储引擎。

## 环境要求

- **Qdrant 版本**: v1.7.0+
- **向量维度**: 默认 1536（适配 OpenAI Embedding 模型）
- **距离度量**: Cosine（余弦相似度）

## 配置说明

### 环境变量配置

在 `service/.env` 文件中配置 Qdrant 相关参数：

```bash
# Qdrant 向量数据库配置
VECTOR_DB_HOST=localhost          # Qdrant 服务主机地址
VECTOR_DB_PORT=6333              # Qdrant 服务端口
VECTOR_DB_API_KEY=               # Qdrant API Key（可选，如启用认证）
VECTOR_DB_COLLECTION=knowledge_base  # 默认集合名称
VECTOR_DB_DIMENSION=1536         # 向量维度
VECTOR_DB_SSL=false              # 是否启用 HTTPS
```

### 配置参数详解

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `VECTOR_DB_HOST` | string | localhost | Qdrant 服务所在主机地址 |
| `VECTOR_DB_PORT` | number | 6333 | Qdrant 服务端口 |
| `VECTOR_DB_API_KEY` | string | 空 | Qdrant 认证密钥（如启用） |
| `VECTOR_DB_COLLECTION` | string | knowledge_base | 默认向量集合名称 |
| `VECTOR_DB_DIMENSION` | number | 1536 | 向量维度，需与 Embedding 模型匹配 |
| `VECTOR_DB_SSL` | boolean | false | 是否使用 HTTPS 连接 |

## 安装与启动

### 方式一：使用 Docker（推荐）

```bash
# 拉取 Qdrant 镜像
docker pull qdrant/qdrant:latest

# 启动 Qdrant 容器
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/qdrant_data:/qdrant/storage \
  qdrant/qdrant:latest
```

### 方式二：使用 Docker Compose

创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'
services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    restart: unless-stopped

volumes:
  qdrant_data:
```

启动命令：
```bash
docker-compose up -d
```

### 方式三：源码编译安装

```bash
# 安装 Rust（如未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 克隆仓库
git clone https://github.com/qdrant/qdrant.git
cd qdrant

# 编译并运行
cargo run --release
```

## 服务验证

启动后可通过以下方式验证服务是否正常：

```bash
# 检查 Qdrant 服务状态
curl http://localhost:6333/health

# 查看所有集合
curl http://localhost:6333/collections
```

## API 使用

### 集合管理

#### 创建集合

```bash
curl -X PUT http://localhost:6333/collections/knowledge_base \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": {
      "size": 1536,
      "distance": "Cosine"
    }
  }'
```

#### 获取集合信息

```bash
curl http://localhost:6333/collections/knowledge_base
```

#### 删除集合

```bash
curl -X DELETE http://localhost:6333/collections/knowledge_base
```

### 向量操作

#### 插入向量

```bash
curl -X PUT http://localhost:6333/collections/knowledge_base/points \
  -H "Content-Type: application/json" \
  -d '{
    "wait": true,
    "points": [
      {
        "id": "chunk_001",
        "vector": [0.1, 0.2, 0.3, ...],
        "payload": {
          "kb_id": "kb_001",
          "doc_id": "doc_001",
          "content": "文档内容片段",
          "doc_name": "文档名称",
          "chunk_index": 0
        }
      }
    ]
  }'
```

#### 搜索相似向量

```bash
curl -X POST http://localhost:6333/collections/knowledge_base/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.1, 0.2, 0.3, ...],
    "limit": 10,
    "filter": {
      "must": [
        {
          "key": "kb_id",
          "match": {
            "value": "kb_001"
          }
        }
      ]
    },
    "with_payload": true,
    "with_vector": false
  }'
```

## 项目集成

### VectorService 服务

项目中通过 `VectorService` 封装了 Qdrant 的操作：

```typescript
import { VectorService } from './vector/vector.service';

// 搜索相似向量
const results = await vectorService.searchSimilar(
  queryVector,  // 查询向量
  10,           // 返回数量
  'kb_001',     // 知识库ID（可选）
);

// 插入向量
await vectorService.insertVectors(
  vectors,      // 向量数组
  payloads,     // 元数据数组
);

// 删除向量
await vectorService.deleteVectors(ids);

// 删除指定知识库的所有向量
await vectorService.deleteByKbId('kb_001');
```

### 自动初始化

`VectorService` 会在模块初始化时自动连接 Qdrant 服务：

```typescript
async onModuleInit() {
  // 创建 Qdrant 客户端连接
  this.client = new QdrantClient({
    url: `${protocol}://${this.config.host}:${this.config.port}`,
    apiKey: this.config.apiKey,
  });
  
  // 验证连接
  await this.client.getCollections();
}
```

### 集合自动创建

当检索时如果集合不存在，系统会自动创建：

```typescript
// searchSimilar 方法中
if (error.message.includes("doesn't exist")) {
  await this.initCollection(name);  // 自动创建集合
  return [];
}
```

## 监控与维护

### 查看日志

```bash
# Docker 容器日志
docker logs -f qdrant

# 查看集合统计信息
curl http://localhost:6333/collections/knowledge_base
```

### 性能优化建议

1. **向量索引**：确保集合使用了合适的索引类型
2. **批量操作**：插入向量时使用批量插入以提高性能
3. **内存配置**：根据数据集大小调整 Qdrant 内存限制
4. **分片部署**：大规模数据可考虑分片部署

## 故障排除

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `Collection doesn't exist` | 集合未创建 | 上传文档触发自动创建，或手动创建集合 |
| `Connection refused` | Qdrant 服务未启动 | 检查 Qdrant 服务状态，确认端口正确 |
| `Invalid API Key` | API Key 配置错误 | 检查环境变量配置 |
| `Vector dimension mismatch` | 向量维度不一致 | 确认 `VECTOR_DB_DIMENSION` 与 Embedding 模型匹配 |

### 调试模式

启动服务时设置日志级别为 DEBUG 可查看详细日志：

```bash
# 查看 VectorService 日志
[VectorService] 搜索相似向量: topK=10, kbId=xxx
[VectorService] 成功插入 100 个向量
```

## 数据备份与恢复

### 备份

```bash
# 停止容器
docker stop qdrant

# 复制数据目录
cp -r qdrant_data /backup/qdrant_data_$(date +%Y%m%d)
```

### 恢复

```bash
# 将备份数据复制到数据目录
cp -r /backup/qdrant_data_20240101/* qdrant_data/

# 启动容器
docker start qdrant
```

## 附录

### Qdrant 管理界面

Qdrant 提供 Web UI 管理界面：
- 访问地址：`http://localhost:6333/dashboard`
- 功能：查看集合、查询向量、监控状态

### 官方文档

- Qdrant 官方文档：https://qdrant.tech/documentation/
- REST API 参考：https://qdrant.tech/documentation/api/
