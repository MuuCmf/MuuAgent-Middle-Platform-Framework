/**
 * 向量数据Payload结构
 */
export interface VectorPayload {
  kb_id: string;
  doc_id: string;
  chunk_id: string;
  chunk_index: number;
  content: string;
  doc_name: string;
  kb_name: string;
}

/**
 * 向量检索结果
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  payload: VectorPayload;
}

/**
 * 向量库配置接口
 */
export interface VectorDbConfig {
  host: string;
  port: number;
  apiKey?: string;
  collectionName?: string;
}
