import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  VectorPayload,
  VectorSearchResult,
  VectorDbConfig,
} from './interfaces/vector.interface';
import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * 向量库服务 - Qdrant REST 客户端实现
 */
@Injectable()
export class VectorService implements OnModuleInit {
  private readonly logger = new Logger(VectorService.name);
  private readonly config: VectorDbConfig;
  private client: QdrantClient;
  private readonly vectorDimension: number;

  /**
   * 构造函数
   */
  constructor() {
    this.config = {
      host: process.env.VECTOR_DB_HOST || 'localhost',
      port: parseInt(process.env.VECTOR_DB_PORT || '6333'),
      apiKey: process.env.VECTOR_DB_API_KEY,
      collectionName: process.env.VECTOR_DB_COLLECTION || 'knowledge_base',
    };
    this.vectorDimension = parseInt(process.env.VECTOR_DB_DIMENSION || '1536');
  }

  /**
   * 模块初始化时创建 Qdrant 客户端连接
   */
  async onModuleInit() {
    try {
      const protocol = process.env.VECTOR_DB_SSL === 'true' ? 'https' : 'http';
      this.client = new QdrantClient({
        url: `${protocol}://${this.config.host}:${this.config.port}`,
        apiKey: this.config.apiKey,
      });

      await this.client.getCollections();
      this.logger.log(`Qdrant 客户端连接成功: ${this.config.host}:${this.config.port}`);
    } catch (error) {
      this.logger.error('Qdrant 客户端连接失败:', error);
      throw error;
    }
  }

  /**
   * 获取集合名称（确保非空）
   */
  private getCollectionName(collectionName?: string): string {
    const name = collectionName || this.config.collectionName;
    if (!name) {
      throw new Error('集合名称不能为空');
    }
    return name;
  }

  /**
   * 初始化向量库集合
   * @param collectionName 集合名称
   * @param vectorSize 向量维度
   * @returns {Promise<boolean>} 初始化结果
   */
  async initCollection(
    collectionName?: string,
    vectorSize: number = this.vectorDimension,
  ): Promise<boolean> {
    try {
      const name = this.getCollectionName(collectionName);
      this.logger.log(`初始化向量库集合: ${name}, 向量维度: ${vectorSize}`);

      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c: { name: string }) => c.name === name);

      if (!exists) {
        await this.client.createCollection(name, {
          vectors: {
            size: vectorSize,
            distance: 'Cosine',
          },
        });
        this.logger.log(`集合 ${name} 创建成功`);
      } else {
        this.logger.log(`集合 ${name} 已存在`);
      }

      return true;
    } catch (error) {
      this.logger.error('初始化向量库集合失败:', error);
      return false;
    }
  }

  /**
   * 插入向量
   * @param vectors 向量数组
   * @param payloads Payload数组
   * @param collectionName 集合名称
   * @returns {Promise<string[]>} 向量ID数组
   */
  async insertVectors(
    vectors: number[][],
    payloads: VectorPayload[],
    collectionName?: string,
  ): Promise<string[]> {
    try {
      const name = this.getCollectionName(collectionName);
      const points = vectors.map((vector, index) => ({
        id: payloads[index].chunk_id,
        vector,
        payload: payloads[index] as unknown as Record<string, unknown>,
      }));

      await this.client.upsert(name, {
        wait: true,
        points,
      });

      const ids = payloads.map((p) => p.chunk_id);
      this.logger.debug(`成功插入 ${ids.length} 个向量`);
      return ids;
    } catch (error) {
      this.logger.error('插入向量失败:', error);
      throw error;
    }
  }

  /**
   * 搜索相似向量
   * @param queryVector 查询向量
   * @param topK 返回数量
   * @param kbId 知识库ID（用于过滤）
   * @param collectionName 集合名称
   * @returns {Promise<VectorSearchResult[]>} 检索结果
   */
  async searchSimilar(
    queryVector: number[],
    topK: number = 5,
    kbId?: string,
    collectionName?: string,
  ): Promise<VectorSearchResult[]> {
    try {
      const name = this.getCollectionName(collectionName);
      this.logger.debug(`搜索相似向量: topK=${topK}, kbId=${kbId || 'all'}`);

      const filter = kbId
        ? {
            must: [
              {
                key: 'kb_id',
                match: {
                  value: kbId,
                },
              },
            ],
          }
        : undefined;

      const result = await this.client.search(name, {
        vector: queryVector,
        limit: topK,
        filter,
        with_payload: true,
        with_vector: false,
      });

      const results: VectorSearchResult[] = result.map((hit) => ({
        id: String(hit.id),
        score: hit.score,
        payload: hit.payload as unknown as VectorPayload,
      }));

      return results;
    } catch (error) {
      this.logger.error('搜索相似向量失败:', error);
      throw error;
    }
  }

  /**
   * 删除向量
   * @param ids 向量ID数组
   * @param collectionName 集合名称
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteVectors(
    ids: string[],
    collectionName?: string,
  ): Promise<boolean> {
    try {
      const name = this.getCollectionName(collectionName);

      await this.client.delete(name, {
        points: ids,
      });

      this.logger.debug(`成功删除 ${ids.length} 个向量`);
      return true;
    } catch (error) {
      this.logger.error('删除向量失败:', error);
      return false;
    }
  }

  /**
   * 根据知识库ID删除所有向量
   * @param kbId 知识库ID
   * @param collectionName 集合名称
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteByKbId(kbId: string, collectionName?: string): Promise<boolean> {
    try {
      const name = this.getCollectionName(collectionName);
      this.logger.debug(`删除知识库所有向量: ${kbId}`);

      await this.client.delete(name, {
        filter: {
          must: [
            {
              key: 'kb_id',
              match: {
                value: kbId,
              },
            },
          ],
        },
      });

      return true;
    } catch (error) {
      this.logger.error('删除知识库向量失败:', error);
      return false;
    }
  }

  /**
   * 根据文档ID删除所有向量
   * @param docId 文档ID
   * @param collectionName 集合名称
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteByDocId(docId: string, collectionName?: string): Promise<boolean> {
    try {
      const name = this.getCollectionName(collectionName);
      this.logger.debug(`删除文档所有向量: ${docId}`);

      await this.client.delete(name, {
        filter: {
          must: [
            {
              key: 'doc_id',
              match: {
                value: docId,
              },
            },
          ],
        },
      });

      return true;
    } catch (error) {
      this.logger.error('删除文档向量失败:', error);
      return false;
    }
  }

  /**
   * 获取集合统计信息
   * @param collectionName 集合名称
   * @returns {Promise<any>} 统计信息
   */
  async getCollectionStats(collectionName?: string): Promise<any> {
    try {
      const name = this.getCollectionName(collectionName);
      const info = await this.client.getCollection(name);

      return {
        name: name,
        vectorCount: info.indexed_vectors_count || 0,
        status: info.status,
        vectorSize: (info.config as any)?.params?.vectors?.size || this.vectorDimension,
        distance: (info.config as any)?.params?.vectors?.distance || 'Cosine',
      };
    } catch (error) {
      this.logger.error('获取集合统计信息失败:', error);
      return null;
    }
  }
}
