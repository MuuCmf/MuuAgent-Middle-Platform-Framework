import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { VectorService } from '../vector/vector.service';
import { AiService } from '../ai/ai.service';
import { CacheService } from '../cache/cache.service';
import { RetrievalDto } from './dto/retrieval.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { v4 as uuidv4 } from 'uuid';
import { AiInvokeDto } from '../ai/dto/ai.dto';

/**
 * 检索结果项
 */
export interface RetrievalItem {
  chunkId: string;
  content: string;
  score: number;
  docId: string;
  docName: string;
  chunkIndex: number;
}

/**
 * 检索和RAG问答服务
 */
@Injectable()
export class RetrievalService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param vectorService 向量服务
   * @param aiService AI服务（用于生成embedding）
   * @param cacheService 缓存服务（用于优化检索性能）
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly aiService: AiService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * 向量检索
   * @param dto 检索参数
   * @returns {Promise<any>} 检索结果
   */
  async retrieval(dto: RetrievalDto): Promise<any> {
    const startTime = Date.now();
    const requestId = uuidv4();

    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false, status: true },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或未启用');
    }

    const topN = dto.topN || kb.topN;
    const similarityThresh = dto.similarityThresh || kb.similarityThresh;

    // 尝试从缓存获取结果
    const cachedResult = await this.cacheService.getRetrievalCache(
      dto.kbId,
      dto.query,
      topN,
      similarityThresh,
    );

    if (cachedResult) {
      const costTime = Date.now() - startTime;
      await this.prisma.kbRetrievalLog.create({
        data: {
          kbId: dto.kbId,
          uid: dto.uid,
          query: dto.query,
          topN,
          similarityThresh,
          retrievalCount: cachedResult.total,
          costTime,
          requestId,
        },
      });
      return { ...cachedResult, costTime, cacheHit: true };
    }

    // 生成查询向量
    const queryVector = await this.generateEmbedding(dto.query);

    // 使用向量库进行检索（添加错误处理）
    let vectorResults: any[] = [];
    try {
      vectorResults = await this.vectorService.searchSimilar(
        queryVector,
        topN * 2, // 多取一些结果用于过滤
        dto.kbId,
      );
    } catch (error) {
      console.log('向量检索异常:', error.data);
      // 记录错误日志
      console.error(`向量检索失败: ${error.message}`);
      // 向量检索失败时返回空结果
      const costTime = Date.now() - startTime;
      await this.prisma.kbRetrievalLog.create({
        data: {
          kbId: dto.kbId,
          uid: dto.uid,
          query: dto.query,
          topN,
          similarityThresh,
          retrievalCount: 0,
          costTime,
          requestId,
        },
      });
      return {
        list: [],
        total: 0,
        costTime,
        cacheHit: false,
        error: '向量检索服务暂时不可用',
      };
    }

    // 按相似度阈值过滤
    const filteredResults = vectorResults.filter((result) => result.score >= similarityThresh);

    // 获取文档名称信息
    const results: RetrievalItem[] = await Promise.all(
      filteredResults.map(async (result) => {
        const doc = await this.prisma.kbDocument.findUnique({
          where: { id: result.payload.doc_id },
          select: { docName: true },
        });

        return {
          chunkId: result.id,
          content: result.payload.content,
          score: result.score,
          docId: result.payload.doc_id,
          docName: doc?.docName || result.payload.doc_name || '未知文档',
          chunkIndex: result.payload.chunk_index,
        };
      }),
    );

    // 按相似度排序并取topN
    results.sort((a, b) => b.score - a.score);
    const finalResults = results.slice(0, topN);

    const costTime = Date.now() - startTime;

    // 将结果存入缓存
    await this.cacheService.setRetrievalCache(
      dto.kbId,
      dto.query,
      topN,
      similarityThresh,
      { list: finalResults, total: finalResults.length },
      3600000, // 1小时缓存
    );

    await this.prisma.kbRetrievalLog.create({
      data: {
        kbId: dto.kbId,
        uid: dto.uid,
        query: dto.query,
        topN,
        similarityThresh,
        retrievalCount: finalResults.length,
        costTime,
        requestId,
      },
    });

    return {
      list: finalResults,
      total: finalResults.length,
      costTime,
      cacheHit: false,
    };
  }

  /**
   * RAG问答
   * @param dto RAG问答参数
   * @returns {Promise<any>} RAG问答结果
   */
  async ragChat(dto: RagChatDto): Promise<any> {
    const startTime = Date.now();
    const requestId = uuidv4();

    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false, status: true },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或未启用');
    }

    const topN = dto.topN || kb.topN;
    const similarityThresh = dto.similarityThresh || kb.similarityThresh;

    // 生成查询向量
    const queryVector = await this.generateEmbedding(dto.query);

    // 使用向量库进行检索
    const vectorResults = await this.vectorService.searchSimilar(
      queryVector,
      topN * 2,
      dto.kbId,
    );

    // 按相似度阈值过滤
    const filteredResults = vectorResults.filter((result) => result.score >= similarityThresh);

    if (filteredResults.length === 0) {
      // 记录检索日志
      await this.prisma.kbRetrievalLog.create({
        data: {
          kbId: dto.kbId,
          uid: dto.uid,
          query: dto.query,
          topN,
          similarityThresh,
          retrievalCount: 0,
          costTime: Date.now() - startTime,
          requestId,
        },
      });

      return {
        answer: '抱歉，我在知识库中没有找到相关信息。',
        sources: [],
        retrievalCount: 0,
        costTime: Date.now() - startTime,
      };
    }

    // 获取文档名称信息
    const sources: RetrievalItem[] = await Promise.all(
      filteredResults.map(async (result) => {
        const doc = await this.prisma.kbDocument.findUnique({
          where: { id: result.payload.doc_id },
          select: { docName: true },
        });

        return {
          chunkId: result.id,
          content: result.payload.content,
          score: result.score,
          docId: result.payload.doc_id,
          docName: doc?.docName || result.payload.doc_name || '未知文档',
          chunkIndex: result.payload.chunk_index,
        };
      }),
    );

    // 按相似度排序并取topN
    sources.sort((a, b) => b.score - a.score);
    const topSources = sources.slice(0, topN);

    const context = topSources.map((s) => s.content).join('\n\n');
    const prompt = this.buildRagPrompt(dto.query, context);
    const answer = await this.callLLM(prompt, dto.uid);

    const costTime = Date.now() - startTime;

    // 记录检索日志
    await this.prisma.kbRetrievalLog.create({
      data: {
        kbId: dto.kbId,
        uid: dto.uid,
        query: dto.query,
        topN,
        similarityThresh,
        retrievalCount: topSources.length,
        costTime,
        requestId,
      },
    });

    return {
      answer,
      sources: topSources,
      retrievalCount: topSources.length,
      costTime,
    };
  }

  /**
   * 生成文本向量
   * @param text 文本内容
   * @returns {Promise<number[]>} 向量数组
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.aiService.embedding(
        { input: text },
        '127.0.0.1',
        'retrieval-service',
      );

      // 处理不同格式的embedding响应
      const data = result.data as any;
      if (data && Array.isArray(data)) {
        return data as number[];
      } else if (result.embedding && Array.isArray(result.embedding)) {
        return result.embedding as number[];
      } else if (data && Array.isArray(data) && data[0] && data[0].embedding) {
        return data[0].embedding as number[];
      } else {
        // 如果没有可用的embedding服务，返回随机向量（用于测试）
        console.warn('Embedding服务不可用，使用随机向量');
        return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
      }
    } catch (error) {
      console.warn('Embedding生成失败，使用随机向量:', error.message);
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
  }

  /**
   * 构建RAG提示词
   * @param query 用户问题
   * @param context 上下文
   * @returns {string} 提示词
   */
  private buildRagPrompt(query: string, context: string): string {
    return `你是一个专业的问答助手。请根据以下参考信息回答用户的问题。

参考信息：
${context}

用户问题：${query}

请基于参考信息给出准确、详细的回答。如果参考信息中没有相关内容，请明确告知用户。`;
  }

  /**
   * 调用LLM生成回答
   * @param prompt 提示词
   * @param uid 用户标识
   * @returns {Promise<string>} 生成的回答
   */
  private async callLLM(prompt: string, uid?: string): Promise<string> {
    try {
      const dto: AiInvokeDto = {
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modelType: 'llm',
        temperature: 0.7,
        maxTokens: 4096,
      };

      const result = await this.aiService.invoke(dto, '127.0.0.1', 'retrieval-service', uid);
      const resultData = result as any;

      // 提取回答内容
      if (resultData.choices && Array.isArray(resultData.choices) && resultData.choices.length > 0) {
        const choice = resultData.choices[0];
        if (choice && choice.message && choice.message.content) {
          return choice.message.content;
        }
      }

      // 兼容其他格式
      if (resultData.response) {
        return String(resultData.response);
      }

      return '抱歉，未能获取到回答。';
    } catch (error) {
      console.error('LLM调用失败:', error.message);
      return '抱歉，回答生成失败，请稍后重试。';
    }
  }
}
