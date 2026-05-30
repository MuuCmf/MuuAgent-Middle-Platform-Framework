import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { VectorService } from '../vector/vector.service';
import { AiService } from '../ai/ai.service';
import { AiInvokeDto } from '../ai/dto/ai.dto';
import { CacheService } from '../cache/cache.service';
import { BM25Service } from './bm25.service';
import { PromptTemplateService } from '../prompt-template/prompt-template.service';
import { ModelTemplateService } from '../model-template/model-template.service';
import { ConversationService } from '../conversation/conversation.service';
import { ConversationType } from '../conversation/dto/create-conversation.dto';
import { RetrievalDto } from './dto/retrieval.dto';
import { RagChatDto } from './dto/rag-chat.dto';
import { v4 as uuidv4 } from 'uuid';
import { IsolationService, IsolationContext } from '../common/services/base-isolated.service';
import { StreamEmitter, StreamEvents } from '../stream';
import { ModelRoutingService } from "../model-routing/model-routing.service";
import { ModelService } from '../model/model.service';

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
   * @param modelTemplateService 模型参数模板服务
   * @param conversationService 会话服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly aiService: AiService,
    private readonly cacheService: CacheService,
    private readonly bm25Service: BM25Service,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly modelTemplateService: ModelTemplateService,
    private readonly conversationService: ConversationService,
    private readonly mcpService: ModelRoutingService,
    private readonly modelService: ModelService,
    private readonly isolationService: IsolationService,
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
   * 向量检索（带缓存击穿保护）
   * @param dto 检索参数
   * @param context 隔离上下文
   * @returns {Promise<any>} 检索结果
   */
  async retrieval(dto: RetrievalDto, context?: IsolationContext): Promise<any> {
    const startTime = Date.now();
    const requestId = uuidv4();

    const isolationWhere = this.isolationService.buildIsolationWhere(context || { appCode: null, skipIsolation: false });
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false, status: true, ...isolationWhere },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或未启用');
    }

    const topN = dto.topN || kb.topN;
    const similarityThresh = dto.similarityThresh || kb.similarityThresh;

    console.log(`[Retrieval] 知识库ID: ${dto.kbId}, 阈值: ${similarityThresh}, topN: ${topN}`);

    const docCount = await this.prisma.kbDocument.count({
      where: { kbId: dto.kbId as any, isDeleted: false, status: 3 },
    });
    console.log(`[Retrieval] 已完成的文档数: ${docCount}`);

    const chunkCount = await this.prisma.kbChunk.count({
      where: { kbId: dto.kbId as any, status: 1 },
    });
    console.log(`[Retrieval] 已向量化的切片数: ${chunkCount}`);

    // 预查缓存用于标记 cacheHit
    const preCached = await this.cacheService.getRetrievalCache(
      dto.kbId, dto.query, topN, similarityThresh,
    );

    // 使用 getOrSet 防止缓存击穿：并发相同查询只有一个执行检索
    const cacheKey = this.cacheService.getRetrievalCacheKey(dto.kbId, dto.query, topN, similarityThresh);
    const retrievalMethod = kb.retrievalMethod || 'vector';

    const { list, total, method } = await this.cacheService.getOrSet(
      cacheKey,
      () => this.doRetrieval(dto.kbId, dto.query, topN, similarityThresh, retrievalMethod, kb.embeddingModel),
      3600000,
    );

    const cacheHit = !!preCached;
    const costTime = Date.now() - startTime;

    await this.prisma.kbRetrievalLog.create({
      data: {
        kbId: dto.kbId as any,
        uid: dto.uid,
        query: dto.query,
        topN,
        similarityThresh,
        retrievalCount: total,
        results: this.formatResultsForLog(list),
        costTime,
        requestId,
        appCode: context?.appCode || kb.appCode,
      },
    });

    return { list, total, costTime, cacheHit, method };
  }

  /**
   * 执行实际检索（不含缓存逻辑），供 getOrSet 的 factory 调用
   * 支持三种模式：bm25纯检索、vector纯检索、hybrid混合检索（RRF融合）
   */
  private async doRetrieval(
    kbId: string,
    query: string,
    topN: number,
    similarityThresh: number,
    retrievalMethod: string,
    embeddingModel?: string,
  ): Promise<{ list: RetrievalItem[]; total: number; method: string }> {
    if (retrievalMethod === 'bm25') {
      console.log(`[Retrieval] 使用配置的BM25检索模式`);
      const bm25Results = await this.bm25Search(kbId, query, topN, similarityThresh);
      return { list: bm25Results, total: bm25Results.length, method: 'bm25' };
    }

    // 向量检索
    let vectorResults: any[] = [];
    let vectorSearchFailed = false;

    try {
      const queryVector = await this.generateEmbedding(query, embeddingModel);
      vectorResults = await this.vectorService.searchSimilar(queryVector, topN * 2, kbId);
    } catch (error: any) {
      console.error(`[Retrieval] 向量检索失败: ${error.message}`);
      vectorSearchFailed = true;
    }

    // 向量检索完全失败时降级到BM25
    if (vectorSearchFailed) {
      console.log(`[Retrieval] 向量检索失败，降级到BM25检索`);
      const bm25Results = await this.bm25Search(kbId, query, topN, similarityThresh);
      return { list: bm25Results, total: bm25Results.length, method: 'bm25' };
    }

    // 同时执行BM25检索，用于混合融合
    let bm25Results: any[] = [];
    try {
      bm25Results = await this.bm25Search(kbId, query, topN * 2, 0);
    } catch (error: any) {
      console.warn(`[Retrieval] BM25检索失败: ${error.message}`);
    }

    // 混合检索：RRF融合向量检索和BM25结果
    if (vectorResults.length > 0 && bm25Results.length > 0) {
      console.log(`[Retrieval] 执行混合检索融合: 向量结果=${vectorResults.length}, BM25结果=${bm25Results.length}`);
      const fusedResults = await this.reciprocalRankFusion(vectorResults, bm25Results, topN, similarityThresh, kbId);
      if (fusedResults.length > 0) {
        return { list: fusedResults, total: fusedResults.length, method: 'hybrid' };
      }
    }

    // 纯向量检索结果处理
    if (vectorResults.length > 0) {
      const sortedVectorResults = [...vectorResults].sort((a, b) => b.score - a.score);
      const topVectorResults = sortedVectorResults.slice(0, topN);
      const filteredResults = topVectorResults.filter((result) => result.score >= similarityThresh);

      console.log(`[Retrieval] 向量检索原始结果数: ${vectorResults.length}, 阈值过滤后: ${filteredResults.length}`);
      if (vectorResults.length > 0) {
        console.log(`[Retrieval] 最高相似度: ${vectorResults[0]?.score?.toFixed(4)}, 最低相似度: ${vectorResults[vectorResults.length - 1]?.score?.toFixed(4)}`);
      }

      if (filteredResults.length > 0) {
        const results: RetrievalItem[] = await Promise.all(
          filteredResults.map(async (result) => {
            const doc = await this.prisma.kbDocument.findUnique({
              where: { id: result.payload.doc_id },
              include: { file: { select: { fileName: true } } },
            });
            return {
              chunkId: result.id,
              content: result.payload.content,
              score: result.score,
              docId: result.payload.doc_id,
              docName: doc?.file?.fileName || result.payload.doc_name || '未知文档',
              chunkIndex: result.payload.chunk_index,
            };
          }),
        );

        results.sort((a, b) => b.score - a.score);
        const finalResults = results.slice(0, topN);
        return { list: finalResults, total: finalResults.length, method: 'vector' };
      }
    }

    // 向量结果为空，降级到BM25
    console.log(`[Retrieval] 向量检索结果为空，降级到BM25检索`);
    if (bm25Results.length === 0) {
      bm25Results = await this.bm25Search(kbId, query, topN, similarityThresh);
    }
    const filteredBm25 = bm25Results
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
    return { list: filteredBm25, total: filteredBm25.length, method: 'bm25' };
  }

  /**
   * RRF (Reciprocal Rank Fusion) 融合算法
   * 将向量检索和BM25检索的结果按排名进行融合，综合两者优势
   * @param vectorResults 向量检索结果
   * @param bm25Results BM25检索结果
   * @param topN 返回数量
   * @param similarityThresh 相似度阈值（用于过滤向量低分结果）
   * @param kbId 知识库ID
   * @returns {Promise<RetrievalItem[]>} 融合后的检索结果
   */
  private async reciprocalRankFusion(
    vectorResults: any[],
    bm25Results: any[],
    topN: number,
    similarityThresh: number,
    kbId: string,
  ): Promise<RetrievalItem[]> {
    const k = 60;
    const vectorWeight = 0.7;
    const bm25Weight = 0.3;
    const scoreMap = new Map<string, { rrfScore: number; vectorScore?: number; bm25Score?: number; payload?: any; id: string }>();

    // 向量检索排名得分
    const sortedVector = [...vectorResults].sort((a, b) => b.score - a.score);
    for (let i = 0; i < sortedVector.length; i++) {
      const result = sortedVector[i];
      const chunkId = String(result.id);
      const rrfScore = vectorWeight / (k + i + 1);
      scoreMap.set(chunkId, {
        rrfScore,
        vectorScore: result.score,
        id: chunkId,
        payload: result.payload,
      });
    }

    // BM25排名得分
    const sortedBm25 = [...bm25Results].sort((a, b) => b.score - a.score);
    for (let i = 0; i < sortedBm25.length; i++) {
      const result = sortedBm25[i];
      const chunkId = String(result.id || result.chunkId);
      const rrfScore = bm25Weight / (k + i + 1);
      const existing = scoreMap.get(chunkId);
      if (existing) {
        existing.rrfScore += rrfScore;
        existing.bm25Score = result.score;
      } else {
        scoreMap.set(chunkId, {
          rrfScore,
          bm25Score: result.score,
          id: chunkId,
          payload: {
            content: result.content,
            doc_id: result.docId,
            doc_name: result.docName,
            chunk_index: result.chunkIndex,
          },
        });
      }
    }

    // 按RRF分数排序
    const fusedEntries = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topN);

    // 转换为统一结果格式
    const results: RetrievalItem[] = await Promise.all(
      fusedEntries.map(async (entry) => {
        const doc = await this.prisma.kbDocument.findUnique({
          where: { id: entry.payload?.doc_id },
          include: { file: { select: { fileName: true } } },
        });

        // 使用向量分数作为主分数，无向量分数时使用归一化的BM25分数
        let finalScore = entry.vectorScore || 0;
        if (!entry.vectorScore && entry.bm25Score) {
          finalScore = Math.min(entry.bm25Score / 10, 1.0);
        }

        return {
          chunkId: entry.id,
          content: entry.payload?.content || '',
          score: finalScore,
          docId: entry.payload?.doc_id,
          docName: doc?.file?.fileName || entry.payload?.doc_name || '未知文档',
          chunkIndex: entry.payload?.chunk_index,
        };
      }),
    );

    // 过滤低于阈值的结果（仅对有向量分数的结果应用阈值）
    const filteredResults = results.filter(r => {
      if (r.score > 0) return r.score >= similarityThresh;
      return true;
    });

    console.log(`[Retrieval] RRF融合结果: 总条目=${fusedEntries.length}, 阈值过滤后=${filteredResults.length}`);
    return filteredResults;
  }

  /**
   * 缓存预热：提取历史高频查询并回填检索缓存
   *
   * 在清空缓存后调用，从 kbRetrievalLog 中提取最近 7 天 top-20 高频查询，
   * 重新执行检索并写入缓存，使后续真实请求可直接命中。
   *
   * @param kbId 知识库ID
   */
  async warmupKbCache(kbId: string): Promise<void> {
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: kbId as any, isDeleted: false, status: true },
    });
    if (!kb) return;

    const topN = kb.topN;
    const similarityThresh = kb.similarityThresh;
    const retrievalMethod = kb.retrievalMethod || 'vector';

    // 提取最近 7 天 top-20 高频查询
    const logs = await this.prisma.$queryRaw<Array<{ query: string; cnt: bigint }>>`
      SELECT query, COUNT(*) as cnt
      FROM kb_retrieval_log
      WHERE kb_id = ${kbId}
        AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY query
      ORDER BY cnt DESC
      LIMIT 20
    `;

    if (!logs || logs.length === 0) {
      console.log(`[CacheWarmup] 知识库 ${kbId} 无历史查询记录，跳过预热`);
      return;
    }

    console.log(`[CacheWarmup] 开始预热知识库 ${kbId}，共 ${logs.length} 个历史高频查询`);

    let warmed = 0;
    for (const log of logs) {
      try {
        const result = await this.doRetrieval(kbId, log.query, topN, similarityThresh, retrievalMethod);
        await this.cacheService.setRetrievalCache(kbId, log.query, topN, similarityThresh, result, 3600000);
        warmed++;
      } catch (err: any) {
        console.warn(`[CacheWarmup] 预热查询失败 (${kbId}): ${log.query}`, err.message);
      }
    }

    console.log(`[CacheWarmup] 知识库 ${kbId} 预热完成 (${warmed}/${logs.length})`);
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

    const isolationContext = context || { appCode: null, skipIsolation: false };
    const conversation = await this.conversationService.getOrCreate(
      ConversationType.KB_RAG,
      dto.kbId,
      dto.conversationId,
      dto.uid,
      isolationContext,
    );

    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(conversation.id as any, 20);
      conversationHistory = historyMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    await this.conversationService.addMessage(
      conversation.id as any,
      'user',
      dto.query,
    );

    const isolationWhere = this.isolationService.buildIsolationWhere(isolationContext);
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
      retrievalResults = await this.executeRetrieval(dto.kbId, dto.query, topN, similarityThresh, retrievalMethod, kb.embeddingModel);
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
          kbId: dto.kbId as any,
          uid: dto.uid,
          query: dto.query,
          topN,
          similarityThresh,
          retrievalCount: 0,
          results: null,
          costTime: Date.now() - startTime,
          requestId,
          appCode: isolationContext?.appCode || kb.appCode,
        },
      });

      const noResultAnswer = '抱歉，我在知识库中没有找到相关信息。';
      await this.conversationService.addMessage(
        conversation.id as any,
        'assistant',
        noResultAnswer,
      );

      if (conversation.messageCount === 0) {
        await this.conversationService.generateTitle(conversation.id as any);
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
          include: { file: { select: { fileName: true } } },
        });

        return {
          chunkId: result.id,
          content: result.payload?.content || result.content,
          score: result.score,
          docId: docId,
          docName: doc?.file?.fileName || docName || '未知文档',
          chunkIndex: result.payload?.chunk_index ?? result.chunkIndex,
        };
      }),
    );

    sources.sort((a, b) => b.score - a.score);
    const topSources = sources.slice(0, topN);

    const retrievalContext = topSources.map((s) => s.content).join('\n\n');
    const prompt = await this.buildRagPrompt(dto.query, retrievalContext, conversationHistory);
    const answer = await this.callLLM(prompt, dto.uid, dto.modelCode);

    const costTime = Date.now() - startTime;

    await this.prisma.kbRetrievalLog.create({
      data: {
        kbId: dto.kbId as any,
        uid: dto.uid,
        query: dto.query,
        topN,
        similarityThresh,
        retrievalCount: topSources.length,
        results: this.formatResultsForLog(topSources),
        costTime,
        requestId,
        appCode: isolationContext?.appCode || kb.appCode,
      },
    });

    await this.conversationService.addMessage(
      conversation.id as any,
      'assistant',
      answer,
      { metadata: { sources: topSources, retrievalCount: topSources.length } },
    );

    if (conversation.messageCount === 0) {
      await this.conversationService.generateTitle(conversation.id as any);
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
   * 流式RAG问答（基于 StreamEmitter）
   * @param dto RAG问答参数
   * @param context 隔离上下文
   * @param emitter 流式发射器
   */
  async ragChatStreamWithEmitter(dto: RagChatDto, context: IsolationContext | undefined, emitter: StreamEmitter): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();

    const isolationContext = context || { appCode: null, skipIsolation: false };
    const conversation = await this.conversationService.getOrCreate(
      ConversationType.KB_RAG,
      dto.kbId,
      dto.conversationId,
      dto.uid,
      isolationContext,
    );

    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (conversation.messageCount > 0) {
      const historyMessages = await this.conversationService.buildContext(conversation.id as any, 20);
      conversationHistory = historyMessages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    }

    await this.conversationService.addMessage(
      conversation.id as any,
      'user',
      dto.query,
    );

    const isolationWhere = this.isolationService.buildIsolationWhere(isolationContext);
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false, status: true, ...isolationWhere },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在或未启用');
    }

    const topN = dto.topN || kb.topN;
    const similarityThresh = dto.similarityThresh || kb.similarityThresh;

    // 发送会话ID
    emitter.emit(StreamEvents.conversationId(conversation.id as any));

    // 执行检索
    const retrievalResults = await this.executeRetrieval(dto.kbId, dto.query, topN, similarityThresh, kb.retrievalMethod || 'vector', kb.embeddingModel);

    let filteredResults: any[];
    if ((kb.retrievalMethod || 'vector') === 'bm25') {
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
        conversation.id as any,
        'assistant',
        noResultAnswer,
      );

      if (conversation.messageCount === 0) {
        await this.conversationService.generateTitle(conversation.id as any);
      }

      emitter.emitTextDelta(noResultAnswer);
      emitter.emitDone({ conversationId: conversation.id as any });
      return;
    }

    const sources: RetrievalItem[] = await Promise.all(
      filteredResults.map(async (result) => {
        const docId = result.payload?.doc_id || result.docId;
        const docName = result.payload?.doc_name || result.docName;

        const doc = await this.prisma.kbDocument.findUnique({
          where: { id: docId },
          include: { file: { select: { fileName: true } } },
        });

        return {
          chunkId: result.id,
          content: result.payload?.content || result.content,
          score: result.score,
          docId: docId,
          docName: doc?.file?.fileName || docName || '未知文档',
          chunkIndex: result.payload?.chunk_index ?? result.chunkIndex,
        };
      }),
    );

    sources.sort((a, b) => b.score - a.score);
    const topSources = sources.slice(0, topN);

    // 发送来源引用事件
    emitter.emit(StreamEvents.sources(topSources));

    const retrievalContext = topSources.map((s) => s.content).join('\n\n');
    const prompt = await this.buildRagPrompt(dto.query, retrievalContext, conversationHistory);

    // 使用 aiService.streamText 直接流式输出，无需二次订阅解析
    try {
      let fullResponse = '';

      await this.aiService.streamText({
        model: await this.selectModelForStream(dto.modelCode),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        maxTokens: 4096,
        clientIp: '127.0.0.1',
        userAgent: 'retrieval-service',
        uid: dto.uid,
        onChunk: (chunk) => {
          fullResponse += chunk;
          emitter.emitTextDelta(chunk);
        },
        onFinish: async () => {
          const costTime = Date.now() - startTime;

          await this.prisma.kbRetrievalLog.create({
            data: {
              kbId: dto.kbId as any,
              uid: dto.uid,
              query: dto.query,
              topN,
              similarityThresh,
              retrievalCount: topSources.length,
              results: this.formatResultsForLog(topSources),
              costTime,
              requestId,
              appCode: isolationContext?.appCode || kb.appCode,
            },
          });
          
          if (fullResponse) {
            await this.conversationService.addMessage(
              conversation.id as any,
              'assistant',
              fullResponse,
              { metadata: { sources: topSources, retrievalCount: topSources.length } },
            );

            if (conversation.messageCount === 0) {
              await this.conversationService.generateTitle(conversation.id as any);
            }
          }
          
          emitter.emitDone({ conversationId: conversation.id as any });
        },
        onError: (error) => {
          emitter.emitError(error instanceof Error ? error.message : String(error));
        },
      });
    } catch (error) {
      emitter.emitError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * 执行检索（抽取公共方法）
   * 支持混合检索：向量+BM25融合
   */
  private async executeRetrieval(
    kbId: string,
    query: string,
    topN: number,
    similarityThresh: number,
    retrievalMethod: string,
    embeddingModel?: string,
  ): Promise<any[]> {
    if (retrievalMethod === 'bm25') {
      return this.bm25Search(kbId, query, topN * 2, similarityThresh);
    }

    // 向量检索
    let vectorResults: any[] = [];
    let vectorSearchFailed = false;

    try {
      const queryVector = await this.generateEmbedding(query, embeddingModel);
      vectorResults = await this.vectorService.searchSimilar(queryVector, topN * 2, kbId);
    } catch (error: any) {
      console.error(`[executeRetrieval] 向量检索失败: ${error.message}`);
      vectorSearchFailed = true;
    }

    // 向量检索完全失败时降级到BM25
    if (vectorSearchFailed) {
      return this.bm25Search(kbId, query, topN * 2, similarityThresh);
    }

    // 同时执行BM25检索
    let bm25Results: any[] = [];
    try {
      bm25Results = await this.bm25Search(kbId, query, topN * 2, 0);
    } catch (error: any) {
      console.warn(`[executeRetrieval] BM25检索失败: ${error.message}`);
    }

    // 混合检索：两者都有结果时进行RRF融合
    if (vectorResults.length > 0 && bm25Results.length > 0) {
      return this.executeRRFFusion(vectorResults, bm25Results, topN * 2);
    }

    // 只有向量结果
    if (vectorResults.length > 0) {
      return vectorResults;
    }

    // 只有BM25结果或两者都为空
    if (bm25Results.length === 0) {
      bm25Results = await this.bm25Search(kbId, query, topN * 2, similarityThresh);
    }
    return bm25Results;
  }

  /**
   * 执行RRF融合（简化版，用于executeRetrieval）
   * @param vectorResults 向量检索结果
   * @param bm25Results BM25检索结果
   * @param topN 返回数量
   * @returns {Promise<any[]>} 融合后的结果
   */
  private async executeRRFFusion(
    vectorResults: any[],
    bm25Results: any[],
    topN: number,
  ): Promise<any[]> {
    const k = 60;
    const vectorWeight = 0.7;
    const bm25Weight = 0.3;
    const scoreMap = new Map<string, { rrfScore: number; data: any }>();

    const sortedVector = [...vectorResults].sort((a, b) => b.score - a.score);
    for (let i = 0; i < sortedVector.length; i++) {
      const result = sortedVector[i];
      const chunkId = String(result.id);
      scoreMap.set(chunkId, {
        rrfScore: vectorWeight / (k + i + 1),
        data: result,
      });
    }

    const sortedBm25 = [...bm25Results].sort((a, b) => b.score - a.score);
    for (let i = 0; i < sortedBm25.length; i++) {
      const result = sortedBm25[i];
      const chunkId = String(result.id || result.chunkId);
      const rrfScore = bm25Weight / (k + i + 1);
      const existing = scoreMap.get(chunkId);
      if (existing) {
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(chunkId, {
          rrfScore,
          data: {
            id: result.id,
            score: result.score,
            payload: {
              content: result.content,
              doc_id: result.docId,
              doc_name: result.docName,
              chunk_index: result.chunkIndex,
            },
          },
        });
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topN)
      .map(entry => entry.data);
  }

  /**
   * 为流式调用选择模型
   */
  private async selectModelForStream(modelCode?: string): Promise<any> {
    if (modelCode && modelCode !== 'mcp') {
      return this.modelService.findByCode(modelCode);
    }
    return this.mcpService.selectModel('llm');
  }

  /**
   * 生成文本向量
   * @param text 文本内容
   * @param modelCode 指定模型编码（可选，使用知识库配置的向量模型）
   * @returns {Promise<number[]>} 向量数组
   * @throws 当Embedding服务不可用时抛出错误，由上层降级到BM25检索
   */
  private async generateEmbedding(text: string, modelCode?: string): Promise<number[]> {
    try {
      const result = await this.aiService.embedding(
        { input: text, modelCode },
        '127.0.0.1',
        'retrieval-service',
      );

      const data = result.data as any;
      if (data && Array.isArray(data)) {
        return data as number[];
      } else if (result.embedding && Array.isArray(result.embedding)) {
        return result.embedding as number[];
      } else if (data && Array.isArray(data) && data[0] && data[0].embedding) {
        return data[0].embedding as number[];
      } else {
        throw new Error('Embedding服务返回数据格式异常，无法解析向量');
      }
    } catch (error: any) {
      console.error(`[Retrieval] Embedding生成失败: ${error.message}`);
      throw error;
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

请按照以下格式回答：
1. 首先在 [THINKING] 标签内写出你的思考过程和分析
2. 然后在 [ANSWER] 标签内给出正式回答

例如：
[THINKING]
根据参考信息，用户问题关于XX，参考信息提到...
[ANSWER]
正式回答内容...

如果参考信息中没有相关内容，请明确告知用户。`;
    }
  }

  /**
   * 调用LLM生成回答
   * @param prompt 提示词
   * @param uid 用户标识
   * @param modelCode 指定模型CODE（可选）
   * @returns {Promise<string>} 生成的回答
   */
  private async callLLM(prompt: string, uid?: string, modelCode?: string): Promise<string> {
    try {
      const template = await this.modelTemplateService.getDefaultTemplate('llm');
      const temperature = template?.temperature ?? 0.7;
      const maxTokens = template?.maxTokens ?? 4096;

      const dto: AiInvokeDto = {
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modelType: 'llm',
        modelCode: modelCode && modelCode !== 'mcp' ? modelCode : undefined,
        temperature,
        maxTokens,
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
    } catch (error: any) {
      console.error('LLM调用失败:', error.message);
      return '抱歉，回答生成失败，请稍后重试。';
    }
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
      where: { kbId: kbId as any, status: 1 },
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
          where: { id: result.docId as any },
          include: { file: { select: { fileName: true } } },
        });
        
        if (!doc) {
          console.warn(`[Retrieval] 未找到文档: ${result.docId}`);
        }

        return {
          chunkId: result.id,
          content: result.content,
          score: result.score,
          docId: result.docId,
          docName: doc?.file?.fileName || result.docName || '未知文档',
          chunkIndex: result.chunkIndex,
        };
      }),
    );

    console.log(`[Retrieval] BM25最终返回结果数: ${results.length}`);
    return results;
  }
}
