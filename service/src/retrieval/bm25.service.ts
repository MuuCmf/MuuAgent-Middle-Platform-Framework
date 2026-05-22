import { Injectable, Logger } from '@nestjs/common';
import { Segment, useDefault } from 'segmentit';

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
 * 中文停用词表
 * 包含常见虚词、代词、连词等，过滤后可提升检索精度
 */
const CHINESE_STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '他', '她', '它', '们', '那', '些', '什么', '怎么', '如何', '哪',
  '为什么', '可以', '能', '吗', '吧', '呢', '啊', '哦', '嗯', '呀', '哈', '嘿',
  '但', '而', '且', '或', '与', '及', '等', '之', '其', '此', '该', '每', '各',
  '中', '里', '下', '后', '前', '时', '年', '月', '日', '多', '少', '大', '小',
  '被', '把', '让', '给', '从', '向', '对', '比', '以', '为', '因', '所',
  '如果', '虽然', '但是', '然后', '所以', '因为', '不过', '还是', '已经',
  '可能', '应该', '需要', '知道', '觉得', '认为', '希望', '想', '请',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
  'not', 'so', 'if', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
]);

/**
 * BM25算法服务
 * 实现经典的BM25文本检索算法，支持中文分词，作为向量检索的备选方案
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
   * 中文分词器实例
   * 使用 segmentit 纯JS分词库，无需编译原生模块
   */
  private segmenter: Segment | null = null;

  /**
   * 初始化中文分词器
   * 延迟加载，首次使用时初始化
   */
  private initSegmenter(): Segment {
    if (!this.segmenter) {
      this.segmenter = new Segment();
      useDefault(this.segmenter);
      this.logger.log('中文分词器(segmentit)初始化完成');
    }
    return this.segmenter;
  }

  /**
   * 添加文档到索引
   * @param id 文档ID
   * @param content 文档内容
   * @param docId 关联文档ID
   * @param docName 关联文档名称
   * @param chunkIndex 切片索引
   */
  addDocument(
    id: string | bigint,
    content: string,
    docId?: string | bigint,
    docName?: string,
    chunkIndex?: number,
  ): void {
    const doc: BM25Document = {
      id: String(id),
      content,
      docId: docId != null ? String(docId) : undefined,
      docName,
      chunkIndex,
    };

    this.documents.set(String(id), doc);
    this.buildIndex(String(id), content);
    this.updateStatistics();
  }

  /**
   * 批量添加文档
   * @param docs 文档数组
   */
  addDocuments(docs: Array<{
    id: string | bigint;
    content: string;
    docId?: string | bigint;
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
    id: string | bigint;
    content: string;
    docId: string | bigint;
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

    this.logger.debug(`BM25查询分词结果: "${query}" -> [${queryTerms.join(', ')}]`);

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
   * 对查询文本进行分词（支持中文智能分词）
   * @param text 文本
   * @returns 词项数组
   */
  private tokenize(text: string): string[] {
    if (!text) return [];

    const hasChinese = /[\u4e00-\u9fa5]/.test(text);

    if (hasChinese) {
      return this.tokenizeChinese(text);
    }

    return this.tokenizeNonChinese(text);
  }

  /**
   * 中文文本分词
   * 使用 segmentit 进行中文分词，过滤停用词和短词
   * @param text 中文文本
   * @returns 词项数组
   */
  private tokenizeChinese(text: string): string[] {
    try {
      const seg = this.initSegmenter();
      const result = seg.doSegment(text, {
        simple: true,
        stripPunctuation: true,
      });

      return result
        .map((term: string) => term.toLowerCase().trim())
        .filter((term: string) => term.length >= this.minTermLength)
        .filter((term: string) => !CHINESE_STOP_WORDS.has(term))
        .filter((term: string) => /[\u4e00-\u9fa5]|[a-z0-9]{2,}/.test(term));
    } catch (error: any) {
      this.logger.warn(`中文分词失败，降级到简单分词: ${error.message}`);
      return this.tokenizeNonChinese(text);
    }
  }

  /**
   * 非中文文本分词（英文、数字等）
   * @param text 非中文文本
   * @returns 词项数组
   */
  private tokenizeNonChinese(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length >= this.minTermLength)
      .filter(term => !CHINESE_STOP_WORDS.has(term))
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
    return Math.max(0, Math.log((this.documentCount - df + 0.5) / (df + 0.5)));
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
