import { Injectable, Logger } from '@nestjs/common';

/**
 * BM25检索结果项
 */
export interface BM25SearchResult {
  id: string;
  content: string;
  score: number;
  docId?: string;
  docName?: string;
  chunkIndex?: number;
}

/**
 * 文档信息
 */
interface BM25Document {
  id: string;
  content: string;
  docId?: string;
  docName?: string;
  chunkIndex?: number;
}

/**
 * BM25参数配置
 */
interface BM25Params {
  k1: number;
  b: number;
  avgdl: number;
}

/**
 * 词项信息
 */
interface TermInfo {
  df: number;
  postings: Map<string, number>;
}

/**
 * BM25算法服务
 * 实现经典的BM25文本检索算法，作为向量检索的备选方案
 */
@Injectable()
export class BM25Service {
  private readonly logger = new Logger(BM25Service.name);
  
  private documents: Map<string, BM25Document> = new Map();
  private termIndex: Map<string, TermInfo> = new Map();
  private documentCount: number = 0;
  private averageDocumentLength: number = 0;
  
  private readonly k1: number = 1.5;
  private readonly b: number = 0.75;
  private readonly minTermLength: number = 1;
  
  /**
   * 添加文档到索引
   * @param id 文档ID
   * @param content 文档内容
   * @param docId 关联文档ID
   * @param docName 关联文档名称
   * @param chunkIndex 切片索引
   */
  addDocument(
    id: string,
    content: string,
    docId?: string,
    docName?: string,
    chunkIndex?: number,
  ): void {
    const doc: BM25Document = {
      id,
      content,
      docId,
      docName,
      chunkIndex,
    };
    
    this.documents.set(id, doc);
    this.buildIndex(id, content);
    this.updateStatistics();
  }
  
  /**
   * 批量添加文档
   * @param docs 文档数组
   */
  addDocuments(docs: Array<{
    id: string;
    content: string;
    docId?: string;
    docName?: string;
    chunkIndex?: number;
  }>): void {
    for (const doc of docs) {
      this.addDocument(doc.id, doc.content, doc.docId, doc.docName, doc.chunkIndex);
    }
  }
  
  /**
   * 从数据库切片构建索引
   * @param chunks 数据库切片数组
   */
  buildIndexFromChunks(chunks: Array<{
    id: string;
    content: string;
    docId: string;
    docName?: string;
    chunkIndex: number;
  }>): void {
    this.clear();
    for (const chunk of chunks) {
      this.addDocument(
        chunk.id,
        chunk.content,
        chunk.docId,
        chunk.docName,
        chunk.chunkIndex,
      );
    }
    this.logger.log(`BM25索引构建完成: ${this.documentCount} 个文档, ${this.termIndex.size} 个词项`);
  }
  
  /**
   * 清空索引
   */
  clear(): void {
    this.documents.clear();
    this.termIndex.clear();
    this.documentCount = 0;
    this.averageDocumentLength = 0;
  }
  
  /**
   * 移除文档
   * @param id 文档ID
   */
  removeDocument(id: string): void {
    const doc = this.documents.get(id);
    if (!doc) return;
    
    const terms = this.tokenize(doc.content);
    for (const term of terms) {
      const termInfo = this.termIndex.get(term);
      if (termInfo) {
        termInfo.postings.delete(id);
        termInfo.df--;
        if (termInfo.df === 0) {
          this.termIndex.delete(term);
        }
      }
    }
    
    this.documents.delete(id);
    this.updateStatistics();
  }
  
  /**
   * 搜索相似文档
   * @param query 查询文本
   * @param topN 返回数量
   * @returns 检索结果
   */
  search(query: string, topN: number = 10): BM25SearchResult[] {
    if (this.documentCount === 0) {
      return [];
    }
    
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) {
      return [];
    }
    
    const scores = new Map<string, number>();
    
    for (const doc of this.documents.values()) {
      const score = this.calculateScore(queryTerms, doc);
      if (score > 0) {
        scores.set(doc.id, score);
      }
    }
    
    const results: BM25SearchResult[] = [];
    const sortedDocs = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN);
    
    for (const [id, score] of sortedDocs) {
      const doc = this.documents.get(id);
      if (doc) {
        results.push({
          id: doc.id,
          content: doc.content,
          score,
          docId: doc.docId,
          docName: doc.docName,
          chunkIndex: doc.chunkIndex,
        });
      }
    }
    
    return results;
  }
  
  /**
   * 对查询文本进行分词
   * @param text 文本
   * @returns 词项数组
   */
  private tokenize(text: string): string[] {
    if (!text) return [];
    
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length >= this.minTermLength)
      .filter(term => /[\u4e00-\u9fa5]|[a-z0-9]{2,}/.test(term));
  }
  
  /**
   * 构建单个文档的倒排索引
   * @param docId 文档ID
   * @param content 文档内容
   */
  private buildIndex(docId: string, content: string): void {
    const terms = this.tokenize(content);
    const termFreq = new Map<string, number>();
    
    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }
    
    for (const [term, tf] of termFreq) {
      let termInfo = this.termIndex.get(term);
      if (!termInfo) {
        termInfo = { df: 0, postings: new Map() };
        this.termIndex.set(term, termInfo);
      }
      
      termInfo.postings.set(docId, tf);
      termInfo.df++;
    }
  }
  
  /**
   * 更新统计信息
   */
  private updateStatistics(): void {
    this.documentCount = this.documents.size;
    
    if (this.documentCount === 0) {
      this.averageDocumentLength = 0;
      return;
    }
    
    let totalLength = 0;
    for (const doc of this.documents.values()) {
      totalLength += this.tokenize(doc.content).length;
    }
    
    this.averageDocumentLength = totalLength / this.documentCount;
  }
  
  /**
   * 计算文档对查询的BM25得分
   * @param queryTerms 查询词项
   * @param doc 文档
   * @returns BM25得分
   */
  private calculateScore(queryTerms: string[], doc: BM25Document): number {
    const docTerms = this.tokenize(doc.content);
    const docLength = docTerms.length;
    
    if (docLength === 0 || this.averageDocumentLength === 0) {
      return 0;
    }
    
    let score = 0;
    const seenTerms = new Set<string>();
    
    for (const term of queryTerms) {
      if (seenTerms.has(term)) continue;
      seenTerms.add(term);
      
      const termInfo = this.termIndex.get(term);
      if (!termInfo) continue;
      
      const tf = termInfo.postings.get(doc.id) || 0;
      if (tf === 0) continue;
      
      const idf = this.calculateIDF(termInfo.df);
      const tfComponent = (tf * (this.k1 + 1)) / (tf + this.k1 * (1 - this.b + this.b * (docLength / this.averageDocumentLength)));
      
      score += idf * tfComponent;
    }
    
    return score;
  }
  
  /**
   * 计算IDF（逆文档频率）
   * @param df 文档频率
   * @returns IDF值
   */
  private calculateIDF(df: number): number {
    if (df === 0) return 0;
    return Math.log((this.documentCount - df + 0.5) / (df + 0.5));
  }
  
  /**
   * 获取索引统计信息
   * @returns 统计信息
   */
  getStats(): {
    documentCount: number;
    termCount: number;
    averageDocumentLength: number;
  } {
    return {
      documentCount: this.documentCount,
      termCount: this.termIndex.size,
      averageDocumentLength: this.averageDocumentLength,
    };
  }
}
