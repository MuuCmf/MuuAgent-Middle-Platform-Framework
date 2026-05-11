import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { VectorService } from '../vector/vector.service';
import { AiService } from '../ai/ai.service';
import { CacheService } from '../cache/cache.service';
import { BM25Service } from './bm25.service';
import { PromptTemplateService } from '../prompt-template/prompt-template.service';
import { ConversationService } from '../conversation/conversation.service';
import { ConversationType } from '../conversation/dto/create-conversation.dto';
import { RetrievalDto } from './dto/retrieval.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { v4 as uuidv4 } from 'uuid';
import { AiInvokeDto } from '../ai/dto/ai.dto';
import { Observable, defer } from 'rxjs';
import { IsolationContext, buildIsolationWhere } from '../common/utils/isolation.util';

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
   * @param bm25Service BM25检索服务（作为向量检索的备选方案）
   * @param promptTemplateService 提示词模板服务
   * @param conversationService 会话服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly aiService: AiService,
    private readonly cacheService: CacheService,
    private readonly bm25Service: BM25Service,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly conversationService: ConversationService,
  ) {}

  /**
   * 格式化检索结果用于日志存储
   * @param results 检索结果列表
   * @param maxContentLength 内容最大长度
   * @returns {string | null} JSON字符串
   */
  private formatResultsForLog(results: RetrievalItem[], maxContentLength: number = 200): string | null {
    if (!results || results.length === 0) {
      return null;
    }
    
    const formattedResults = results.map(r => ({
      chunkId: r.chunkId,
      score: Math.round(r.score * 10000) / 10000,
      docName: r.docName,
      content: r.content.length > maxContentLength 
        ? r.content.substring(0, maxContentLength) + '...' 
        : r.content,
    }));
    
    return JSON.stringify(formattedResults);
  }

  /**
   * 向量检索
   * @param dto 检索参数
   * @param context 隔离上下文
   * @returns {Promise<any>} 检索结果
   */
  async retrieval(dto: RetrievalDto, context?: IsolationContext): Promise<any> {
    const startTime = Date.now();
    const requestId = uuidv4();

    const isolationWhere = buildIsolationWhere(context || { appCode: null, isSuperAdmin: false });
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false, status: true, ...isolationWhere },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或未启用');
    }

    const topN = dto.topN || kb.topN;
    const similarityThresh = dto.similarityThresh || kb.similarityThresh;
    
    // 调试日志：检查知识库配置
    console.log(`[Retrieval] 知识库ID: ${dto.kbId}, 阈值: ${similarityThresh}, topN: ${topN}`);
    
    // 检查文档状态
    const docCount = await this.prisma.kbDocument.count({
      where: { kbId: dto.kbId, isDeleted: false, status: 3 },
    });
    console.log(`[Retrieval] 已完成的文档数: ${docCount}`);
    
    // 检查切片数量
    const chunkCount = await this.prisma.kbChunk.count({
      where: { kbId: dto.kbId, status: 1 },
    });
    console.log(`[Retrieval] 已向量化的切片数: ${chunkCount}`);

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
          results: this.formatResultsForLog(cachedResult.list),
          costTime,
          requestId,
        },
      });
      return { ...cachedResult, costTime, cacheHit: true };
    }

    // 根据知识库配置选择检索方式
    const retrievalMethod = kb.retrievalMethod || 'vector';
    console.log(`[Retrieval] 知识库检索方式: ${retrievalMethod}`);

    // 如果配置为BM25，则直接使用BM25检索，无需生成向量
    if (retrievalMethod === 'bm25') {
      console.log(`[Retrieval] 使用配置的BM25检索模式`);
      const bm25Results = await this.bm25Search(dto.kbId, dto.query, topN, similarityThresh);

      const costTime = Date.now() - startTime;

      await this.prisma.kbRetrievalLog.create({
        data: {
          kbId: dto.kbId,
          uid: dto.uid,
          query: dto.query,
          topN,
          similarityThresh,
          retrievalCount: bm25Results.length,
          results: this.formatResultsForLog(bm25Results),
          costTime,
          requestId,
        },
      });

      return {
        list: bm25Results,
        total: bm25Results.length,
        costTime,
        cacheHit: false,
        method: 'bm25',
      };
    }

    // 使用向量库进行检索（添加错误处理）
    let vectorResults: any[] = [];
    let vectorSearchFailed = false;
    let isRandomVector = false;

    try {
      // 生成查询向量（仅在向量检索模式下）
      const queryVector = await this.generateEmbedding(dto.query);
      isRandomVector = this.isRandomVector(queryVector);
      
      vectorResults = await this.vectorService.searchSimilar(
        queryVector,
        topN * 2, // 多取一些结果用于过滤
        dto.kbId,
      );
    } catch (error) {
      console.log('向量检索异常:', error.data);
      console.error(`向量检索失败: ${error.message}`);
      vectorSearchFailed = true;
    }

    // 当向量检索失败或使用随机向量时，使用BM25作为fallback
    if (vectorSearchFailed || isRandomVector || vectorResults.length === 0) {
      console.log(`[Retrieval] 使用BM25检索作为fallback (vectorSearchFailed=${vectorSearchFailed}, isRandomVector=${isRandomVector})`);

      const bm25Results = await this.bm25Search(dto.kbId, dto.query, topN, similarityThresh);

      const costTime = Date.now() - startTime;

      await this.prisma.kbRetrievalLog.create({
        data: {
          kbId: dto.kbId,
          uid: dto.uid,
          query: dto.query,
          topN,
          similarityThresh,
          retrievalCount: bm25Results.length,
          results: this.formatResultsForLog(bm25Results),
          costTime,
          requestId,
        },
      });

      return {
        list: bm25Results,
        total: bm25Results.length,
        costTime,
        cacheHit: false,
        method: 'bm25',
      };
    }

    // 按相似度阈值过滤（向量检索使用自适应阈值）
    const sortedVectorResults = [...vectorResults].sort((a, b) => b.score - a.score);
    const topVectorResults = sortedVectorResults.slice(0, topN);
    
    // 如果最高相似度低于0.5，说明向量质量较差，使用BM25作为fallback
    let filteredResults: any[];
    if (topVectorResults.length > 0 && topVectorResults[0].score < 0.5) {
      console.log(`[Retrieval] 向量相似度较低(${topVectorResults[0].score.toFixed(4)}), 使用BM25作为fallback`);
      filteredResults = []; // 置空以触发fallback
    } else {
      filteredResults = topVectorResults.filter((result) => result.score >= similarityThresh);
    }
    
    // 调试日志：检查检索结果
    console.log(`[Retrieval] Qdrant返回原始结果数: ${vectorResults.length}`);
    console.log(`[Retrieval] 阈值过滤后结果数: ${filteredResults.length}`);
    if (vectorResults.length > 0) {
      console.log(`[Retrieval] 最高相似度: ${vectorResults[0]?.score?.toFixed(4)}, 最低相似度: ${vectorResults[vectorResults.length - 1]?.score?.toFixed(4)}`);
    }

    // 如果向量检索过滤后结果为空，使用BM25作为fallback
    if (filteredResults.length === 0) {
      console.log(`[Retrieval] 向量检索结果为空，使用BM25作为fallback`);

      const bm25Results = await this.bm25Search(dto.kbId, dto.query, topN, similarityThresh);

      const costTime = Date.now() - startTime;

      await this.prisma.kbRetrievalLog.create({
        data: {
          kbId: dto.kbId,
          uid: dto.uid,
          query: dto.query,
          topN,
          similarityThresh,
          retrievalCount: bm25Results.length,
          results: this.formatResultsForLog(bm25Results),
          costTime,
          requestId,
        },
      });

      return {
        list: bm25Results,
        total: bm25Results.length,
        costTime,
        cacheHit: false,
        method: 'bm25',
      };
    }

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
        results: this.formatResultsForLog(finalResults),
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
   * @param context 隔离上下文
   * @returns {Promise<any>} RAG问答结果
   */
  async ragChat(dto: RagChatDto, context?: IsolationContext): Promise<any> {
    const startTime = Date.now();
    const requestId = uuidv4();

    const isolationContext = context || { appCode: null, isSuperAdmin: false };
    const conversation = await this.conversationService.getOrCreate(
      ConversationType.KB_RAG,
      dto.kbId,
      dto.conversationId,
      dto.uid,
      isolationContext,
    );

    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(conversation.id, 20);
      conversationHistory = historyMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    await this.conversationService.addMessage(
      conversation.id,
      'user',
      dto.query,
    );

    const isolationWhere = buildIsolationWhere(isolationContext);
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false, status: true, ...isolationWhere },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或未启用');
    }

    const topN = dto.topN || kb.topN;
    const similarityThresh = dto.similarityThresh || kb.similarityThresh;

    const retrievalMethod = kb.retrievalMethod || 'vector';
    console.log(`[RAG] 知识库检索方式: ${retrievalMethod}`);

    let retrievalResults: any[] = [];

    if (retrievalMethod === 'bm25') {
      console.log(`[RAG] 使用配置的BM25检索模式`);
      retrievalResults = await this.bm25Search(dto.kbId, dto.query, topN * 2, similarityThresh);
    } else {
      let queryVector: number[];
      let isRandomVector = false;
      
      try {
        queryVector = await this.generateEmbedding(dto.query);
        isRandomVector = this.isRandomVector(queryVector);
        
        retrievalResults = await this.vectorService.searchSimilar(
          queryVector,
          topN * 2,
          dto.kbId,
        );
        if (isRandomVector || retrievalResults.length === 0) {
          console.log(`[RAG] 向量检索降级到BM25`);
          retrievalResults = await this.bm25Search(dto.kbId, dto.query, topN * 2, similarityThresh);
        }
      } catch (error) {
        console.error(`[RAG] 向量检索失败: ${error.message}`);
        retrievalResults = await this.bm25Search(dto.kbId, dto.query, topN * 2, similarityThresh);
      }
    }

    let filteredResults: any[];
    
    if (retrievalMethod === 'bm25') {
      const sortedResults = [...retrievalResults].sort((a, b) => b.score - a.score);
      const topResults = sortedResults.slice(0, topN);
      const avgScore = topResults.length > 0 
        ? topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length 
        : 0;
      let effectiveThresh = 0;
      if (topResults.length > 0 && topResults[0].score >= 1) {
        effectiveThresh = avgScore * 0.5;
      }
      filteredResults = topResults.filter(r => r.score >= effectiveThresh);
      console.log(`[RAG] BM25过滤后结果数: ${filteredResults.length}`);
    } else {
      filteredResults = retrievalResults.filter((result) => result.score >= similarityThresh);
    }

    if (filteredResults.length === 0) {
      await this.prisma.kbRetrievalLog.create({
        data: {
          kbId: dto.kbId,
          uid: dto.uid,
          query: dto.query,
          topN,
          similarityThresh,
          retrievalCount: 0,
          results: null,
          costTime: Date.now() - startTime,
          requestId,
        },
      });

      const noResultAnswer = '抱歉，我在知识库中没有找到相关信息。';
      await this.conversationService.addMessage(
        conversation.id,
        'assistant',
        noResultAnswer,
      );

      if (conversation.messageCount === 0) {
        await this.conversationService.generateTitle(conversation.id);
      }

      return {
        answer: noResultAnswer,
        sources: [],
        retrievalCount: 0,
        costTime: Date.now() - startTime,
        conversationId: conversation.id,
      };
    }

    const sources: RetrievalItem[] = await Promise.all(
      filteredResults.map(async (result) => {
        const docId = result.payload?.doc_id || result.docId;
        const docName = result.payload?.doc_name || result.docName;

        const doc = await this.prisma.kbDocument.findUnique({
          where: { id: docId },
          select: { docName: true },
        });

        return {
          chunkId: result.id,
          content: result.payload?.content || result.content,
          score: result.score,
          docId: docId,
          docName: doc?.docName || docName || '未知文档',
          chunkIndex: result.payload?.chunk_index ?? result.chunkIndex,
        };
      }),
    );

    sources.sort((a, b) => b.score - a.score);
    const topSources = sources.slice(0, topN);

    const retrievalContext = topSources.map((s) => s.content).join('\n\n');
    const prompt = await this.buildRagPrompt(dto.query, retrievalContext, conversationHistory);
    const answer = await this.callLLM(prompt, dto.uid);

    const costTime = Date.now() - startTime;

    await this.prisma.kbRetrievalLog.create({
      data: {
        kbId: dto.kbId,
        uid: dto.uid,
        query: dto.query,
        topN,
        similarityThresh,
        retrievalCount: topSources.length,
        results: this.formatResultsForLog(topSources),
        costTime,
        requestId,
      },
    });

    await this.conversationService.addMessage(
      conversation.id,
      'assistant',
      answer,
      { metadata: { sources: topSources, retrievalCount: topSources.length } },
    );

    if (conversation.messageCount === 0) {
      await this.conversationService.generateTitle(conversation.id);
    }

    return {
      answer,
      sources: topSources,
      retrievalCount: topSources.length,
      costTime,
      conversationId: conversation.id,
    };
  }

  /**
   * 流式RAG问答
   * @param dto RAG问答参数
   * @param context 隔离上下文
   * @returns {Observable<any>} 流式响应
   */
  async ragChatStream(dto: RagChatDto, context?: IsolationContext): Promise<Observable<any>> {
    const startTime = Date.now();
    const requestId = uuidv4();

    const isolationContext = context || { appCode: null, isSuperAdmin: false };
    const conversation = await this.conversationService.getOrCreate(
      ConversationType.KB_RAG,
      dto.kbId,
      dto.conversationId,
      dto.uid,
      isolationContext,
    );

    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(conversation.id, 20);
      conversationHistory = historyMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    await this.conversationService.addMessage(
      conversation.id,
      'user',
      dto.query,
    );

    const isolationWhere = buildIsolationWhere(isolationContext);
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false, status: true, ...isolationWhere },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或未启用');
    }

    const topN = dto.topN || kb.topN;
    const similarityThresh = dto.similarityThresh || kb.similarityThresh;

    const retrievalMethod = kb.retrievalMethod || 'vector';
    console.log(`[RAG Stream] 知识库检索方式: ${retrievalMethod}`);

    let retrievalResults: any[] = [];

    if (retrievalMethod === 'bm25') {
      console.log(`[RAG Stream] 使用配置的BM25检索模式`);
      retrievalResults = await this.bm25Search(dto.kbId, dto.query, topN * 2, similarityThresh);
    } else {
      let queryVector: number[];
      let isRandomVector = false;
      
      try {
        queryVector = await this.generateEmbedding(dto.query);
        isRandomVector = this.isRandomVector(queryVector);
        
        retrievalResults = await this.vectorService.searchSimilar(
          queryVector,
          topN * 2,
          dto.kbId,
        );
        if (isRandomVector || retrievalResults.length === 0) {
          console.log(`[RAG Stream] 向量检索降级到BM25`);
          retrievalResults = await this.bm25Search(dto.kbId, dto.query, topN * 2, similarityThresh);
        }
      } catch (error) {
        console.error(`[RAG Stream] 向量检索失败: ${error.message}`);
        retrievalResults = await this.bm25Search(dto.kbId, dto.query, topN * 2, similarityThresh);
      }
    }

    let filteredResults: any[];
    
    if (retrievalMethod === 'bm25') {
      const sortedResults = [...retrievalResults].sort((a, b) => b.score - a.score);
      const topResults = sortedResults.slice(0, topN);
      const avgScore = topResults.length > 0 
        ? topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length 
        : 0;
      let effectiveThresh = 0;
      if (topResults.length > 0 && topResults[0].score >= 1) {
        effectiveThresh = avgScore * 0.5;
      }
      filteredResults = topResults.filter(r => r.score >= effectiveThresh);
    } else {
      filteredResults = retrievalResults.filter((result) => result.score >= similarityThresh);
    }

    if (filteredResults.length === 0) {
      const noResultAnswer = '抱歉，我在知识库中没有找到相关信息。';
      await this.conversationService.addMessage(
        conversation.id,
        'assistant',
        noResultAnswer,
      );

      if (conversation.messageCount === 0) {
        await this.conversationService.generateTitle(conversation.id);
      }

      return new Observable((observer) => {
        observer.next(JSON.stringify({ content: noResultAnswer }));
        observer.next(JSON.stringify({ conversationId: conversation.id }));
        observer.complete();
      });
    }

    const sources: RetrievalItem[] = await Promise.all(
      filteredResults.map(async (result) => {
        const docId = result.payload?.doc_id || result.docId;
        const docName = result.payload?.doc_name || result.docName;

        const doc = await this.prisma.kbDocument.findUnique({
          where: { id: docId },
          select: { docName: true },
        });

        return {
          chunkId: result.id,
          content: result.payload?.content || result.content,
          score: result.score,
          docId: docId,
          docName: doc?.docName || docName || '未知文档',
          chunkIndex: result.payload?.chunk_index ?? result.chunkIndex,
        };
      }),
    );

    sources.sort((a, b) => b.score - a.score);
    const topSources = sources.slice(0, topN);

    const retrievalContext = topSources.map((s) => s.content).join('\n\n');
    const prompt = await this.buildRagPrompt(dto.query, retrievalContext, conversationHistory);

    return defer(() => {
      return new Observable((observer) => {
        console.log('[RAG Stream] Observable被订阅，准备发送sources');
        observer.next(JSON.stringify({ sources: topSources }));
        console.log('[RAG Stream] 已发送sources');
        
        const llmDto: AiInvokeDto = {
          messages: [{ role: 'user', content: prompt }],
          modelType: 'llm',
          temperature: 0.7,
          maxTokens: 4096,
        };

        console.log('[RAG Stream] 准备调用LLM流式接口');
        const stream$ = this.aiService.streamInvoke(llmDto, '127.0.0.1', 'retrieval-service', dto.uid);
        console.log('[RAG Stream] 已获取LLM Observable');
        
        console.log('[RAG Stream] 开始订阅LLM流');
        let fullResponse = '';
        const llmSubscription = stream$.subscribe({
        next: (event: any) => {
          const rawData = event.data || event;
          console.log('[RAG Stream] LLM响应原始数据类型:', typeof rawData);
          console.log('[RAG Stream] LLM响应原始数据:', rawData);
          
          let data;
          try {
            data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          } catch (e) {
            console.error('[RAG Stream] JSON解析失败:', rawData);
            return;
          }
          
          console.log('[RAG Stream] LLM响应数据:', JSON.stringify(data));
          
          if (data && typeof data === 'object') {
            let content: string | null = null;
            
            if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
              const choice = data.choices[0];
              if (choice.delta && typeof choice.delta.content === 'string') {
                content = choice.delta.content;
              } 
              else if (choice.message && typeof choice.message.content === 'string') {
                content = choice.message.content;
              }
            } 
            else if (typeof data.content === 'string') {
              content = data.content;
            }
            else if (typeof data.response === 'string') {
              content = data.response;
            } else if (typeof data.text === 'string') {
              content = data.text;
            }
            
            if (content) {
              fullResponse += content;
              console.log('[RAG Stream] 发送内容:', content.substring(0, 100) + (content.length > 100 ? '...' : ''));
              observer.next(JSON.stringify({ 
                choices: [{ 
                  delta: { content } 
                }] 
              }));
              console.log('[RAG Stream] 已发送给Observer');
            } else {
              console.warn('[RAG Stream] 无法解析LLM响应数据，未找到content字段或content为空');
              console.log('[RAG Stream] 完整数据:', JSON.stringify(data));
            }
          }
        },
        error: (error) => {
          console.error('[RAG Stream] LLM流式调用失败:', error);
          observer.error(error);
        },
        complete: async () => {
          const costTime = Date.now() - startTime;
          
          if (fullResponse) {
            await this.conversationService.addMessage(
              conversation.id,
              'assistant',
              fullResponse,
              { metadata: { sources: topSources, retrievalCount: topSources.length } },
            );

            if (conversation.messageCount === 0) {
              await this.conversationService.generateTitle(conversation.id);
            }
          }
          
          await this.prisma.kbRetrievalLog.create({
            data: {
              kbId: dto.kbId,
              uid: dto.uid,
              query: dto.query,
              topN,
              similarityThresh,
              retrievalCount: topSources.length,
              results: this.formatResultsForLog(topSources),
              costTime,
              requestId,
            },
          });
          
          observer.next(JSON.stringify({ conversationId: conversation.id }));
          observer.complete();
        },
      });
      
      return () => {
        console.log('[RAG Stream] 取消订阅');
        llmSubscription.unsubscribe();
      };
    });
  });
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
   * @returns {Promise<string>} 提示词
   */
  /**
   * 构建RAG提示词
   * @param query 用户查询
   * @param context 检索上下文
   * @param conversationHistory 会话历史
   * @returns {Promise<string>} 提示词
   */
  private async buildRagPrompt(query: string, context: string, conversationHistory?: Array<{ role: string; content: string }>): Promise<string> {
    try {
      const historyText = conversationHistory && conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n')
        : '';

      const prompt = await this.promptTemplateService.render('rag-chat-default', {
        context: context,
        query: query,
        conversationHistory: historyText,
      });
      return prompt;
    } catch (error) {
      const historySection = conversationHistory && conversationHistory.length > 0
        ? `\n\n历史对话：\n${conversationHistory.map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n')}\n`
        : '';

      return `你是一个专业的问答助手。请根据以下参考信息回答用户的问题。${historySection}

参考信息：
${context}

用户问题：${query}

请基于参考信息给出准确、详细的回答。如果参考信息中没有相关内容，请明确告知用户。`;
    }
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

  /**
   * 判断向量是否为随机向量
   * @param vector 向量数组
   * @returns {boolean} 是否为随机向量
   */
  private isRandomVector(vector: number[]): boolean {
    if (!vector || vector.length === 0) return true;
    
    const firstValue = vector[0];
    const isRandomLike = Math.abs(firstValue) < 1 && firstValue > -1 && firstValue !== 0;
    
    if (!isRandomLike) return false;
    
    const variance = this.calculateVectorVariance(vector);
    const mean = vector.reduce((sum, v) => sum + v, 0) / vector.length;
    const expectedVarianceForRandom = 1 / 3;
    
    return Math.abs(variance - expectedVarianceForRandom) < 0.1;
  }

  /**
   * 计算向量方差
   * @param vector 向量数组
   * @returns {number} 方差
   */
  private calculateVectorVariance(vector: number[]): number {
    const mean = vector.reduce((sum, v) => sum + v, 0) / vector.length;
    const squaredDiffs = vector.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / vector.length;
  }

  /**
   * 使用BM25进行文本检索
   * @param kbId 知识库ID
   * @param query 查询文本
   * @param topN 返回数量
   * @param scoreThresh 分数阈值
   * @returns {Promise<any[]>} 检索结果
   */
  private async bm25Search(
    kbId: string,
    query: string,
    topN: number,
    scoreThresh: number,
  ): Promise<any[]> {
    const chunks = await this.prisma.kbChunk.findMany({
      where: { kbId, status: 1 },
      select: {
        id: true,
        content: true,
        docId: true,
        chunkIndex: true,
      },
    });

    if (chunks.length === 0) {
      return [];
    }

    this.bm25Service.clear();
    this.bm25Service.buildIndexFromChunks(chunks);

    const bm25Results = this.bm25Service.search(query, topN * 2);
    
    // 调试日志：查看BM25检索结果
    if (bm25Results.length > 0) {
      console.log(`[Retrieval] BM25原始结果数: ${bm25Results.length}`);
      console.log(`[Retrieval] BM25最高分数: ${bm25Results[0]?.score?.toFixed(4)}, 最低分数: ${bm25Results[bm25Results.length - 1]?.score?.toFixed(4)}`);
    }

    // BM25分数范围与向量相似度不同，使用相对阈值
    // 取前topN结果中分数高于平均分数的文档
    const sortedResults = [...bm25Results].sort((a, b) => b.score - a.score);
    const topResults = sortedResults.slice(0, topN);
    
    // 计算平均分数作为阈值
    const avgScore = topResults.length > 0 
      ? topResults.reduce((sum, r) => sum + r.score, 0) / topResults.length 
      : 0;
    
    // 使用自适应阈值：如果最高分数低于1，则不过滤；否则使用平均分数的一半作为阈值
    let effectiveThresh = 0;
    if (topResults.length > 0 && topResults[0].score >= 1) {
      effectiveThresh = avgScore * 0.5;
    }
    
    console.log(`[Retrieval] BM25平均分数: ${avgScore.toFixed(4)}, 有效阈值: ${effectiveThresh.toFixed(4)}`);
    
    const filteredResults = topResults.filter(r => r.score >= effectiveThresh);
    console.log(`[Retrieval] BM25阈值过滤后结果数: ${filteredResults.length}`);
    
    if (filteredResults.length > 0) {
      console.log(`[Retrieval] BM25过滤后结果示例:`, JSON.stringify(filteredResults[0], null, 2));
    }

    const results: any[] = await Promise.all(
      filteredResults.slice(0, topN).map(async (result) => {
        const doc = await this.prisma.kbDocument.findUnique({
          where: { id: result.docId },
          select: { docName: true },
        });
        
        if (!doc) {
          console.warn(`[Retrieval] 未找到文档: ${result.docId}`);
        }

        return {
          chunkId: result.id,
          content: result.content,
          score: result.score,
          docId: result.docId,
          docName: doc?.docName || result.docName || '未知文档',
          chunkIndex: result.chunkIndex,
        };
      }),
    );

    console.log(`[Retrieval] BM25最终返回结果数: ${results.length}`);
    return results;
  }
}
