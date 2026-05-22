import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VectorService } from '../../vector/vector.service';
import { AiService } from '../../ai/ai.service';
import { FileService } from '../../file/file.service';
import { CacheService } from '../../cache/cache.service';
import { RetrievalService } from '../../retrieval/retrieval.service';
import * as iconv from 'iconv-lite';

/**
 * 文档处理处理器
 * 负责异步处理文档切片和向量生成
 */
@Processor('document')
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param vectorService 向量服务
   * @param aiService AI服务
   * @param fileService 文件服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly aiService: AiService,
    private readonly fileService: FileService,
    private readonly cacheService: CacheService,
    private readonly retrievalService: RetrievalService,
  ) {}

  /**
   * 处理文档任务
   * @param job 任务对象
   */
  @Process('process-document')
  async handleProcessDocument(job: Job<{
    docId: string;
    kbId: string;
    fileId: string;
    kb: any;
  }>) {
    const { docId, kbId, fileId, kb } = job.data;

    try {
      await this.prisma.kbDocument.update({
        where: { id: docId as any },
        data: { status: 1 },
      });

      const content = await this.extractTextFromFile(fileId);
      const chunks = this.splitText(content, kb.chunkSize, kb.chunkOverlap);

      await this.prisma.kbDocument.update({
        where: { id: docId as any },
        data: { totalChunks: chunks.length },
      });

      const kbInfo = await this.prisma.kbInfo.findFirst({
        where: { id: kbId as any, isDeleted: false },
        select: { retrievalMethod: true },
      });
      const retrievalMethod = kbInfo?.retrievalMethod || 'vector';

      if (retrievalMethod === 'vector') {
        const vectorPayloads = [];
        const vectors: number[][] = [];

        for (let i = 0; i < chunks.length; i++) {
          // 让中间件自动生成雪花 ID
          const chunk = await this.prisma.kbChunk.create({
            data: {
              kbId: kbId as any,
              docId: docId as any,
              content: chunks[i],
              chunkIndex: i,
              status: 0,
            },
          });

          const embeddingResult = await this.generateEmbedding(chunks[i]);
          vectors.push(embeddingResult);

          vectorPayloads.push({
            kb_id: kbId as any,
            doc_id: docId as any,
            chunk_id: chunk.id as any,
            chunk_index: i,
            content: chunks[i],
            doc_name: kbId as any,
            kb_name: kb.kbName || '',
          });
        }

        if (vectors.length > 0) {
          await this.vectorService.insertVectors(vectors, vectorPayloads);
          this.logger.log(`文档 ${docId} 的 ${vectors.length} 个向量已写入 Qdrant`);
        }
      } else {
        for (let i = 0; i < chunks.length; i++) {
          // 让中间件自动生成雪花 ID
          await this.prisma.kbChunk.create({
            data: {
              kbId: kbId as any,
              docId: docId as any,
              content: chunks[i],
              chunkIndex: i,
              status: 1,
            },
          });
        }
        this.logger.log(`文档 ${docId} 使用BM25检索方式，跳过向量生成`);
      }

      await this.prisma.kbChunk.updateMany({
        where: { docId: docId as any },
        data: { status: 1 },
      });

      await this.prisma.kbDocument.update({
        where: { id: docId as any },
        data: { status: 1 },
      });

      // 文档处理完成后清除知识库检索缓存
      this.cacheService.clearKbCache(kbId).catch(err =>
        this.logger.warn(`清除知识库 ${kbId} 缓存失败:`, err),
      );

      // 异步预热：用历史高频查询回填缓存
      this.retrievalService.warmupKbCache(kbId).catch(err =>
        this.logger.warn(`预热知识库 ${kbId} 缓存失败:`, err),
      );

      this.logger.log(`文档处理完成: ${docId}, 切片数: ${chunks.length}`);
    } catch (error) {
      this.logger.error(`文档处理失败 ${docId}:`, error);
      await this.prisma.kbDocument.update({
        where: { id: docId as any },
        data: { status: 2 },
      });

      // 文档处理失败也可能已写入部分数据，清除缓存
      this.cacheService.clearKbCache(kbId).catch(err =>
        this.logger.warn(`清除知识库 ${kbId} 缓存失败:`, err),
      );

      throw error;
    }
  }

  /**
   * 从文件ID提取文本内容
   * @param fileId 文件ID
   * @returns {Promise<string>} 文本内容
   */
  private async extractTextFromFile(fileId: string): Promise<string> {
    const downloadResult = await this.fileService.download(fileId);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      downloadResult.stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      downloadResult.stream.on('end', () => resolve(Buffer.concat(chunks)));
      downloadResult.stream.on('error', reject);
    });

    return this.extractTextFromBuffer(buffer);
  }

  /**
   * 检测字符串是否包含乱码字符
   * @param str 字符串
   * @returns {boolean} 是否包含乱码
   */
  private containsGarbledChars(str: string): boolean {
    const replacementCharCount = (str.match(/\uFFFD/g) || []).length;
    return replacementCharCount > str.length * 0.05;
  }

  /**
   * 从Buffer提取文本内容
   * @param buffer 文件Buffer
   * @returns {Promise<string>} 文本内容
   */
  private async extractTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      let content = buffer.toString('utf-8');

      if (this.containsGarbledChars(content)) {
        try {
          content = iconv.decode(buffer, 'GBK');
          this.logger.log('使用GBK编码解码');
        } catch (gbkError) {
          try {
            content = iconv.decode(buffer, 'GB2312');
            this.logger.log('使用GB2312编码解码');
          } catch (gb2312Error) {
            this.logger.warn('编码检测失败，使用原始UTF-8内容');
          }
        }
      }

      return content;
    } catch (error) {
      this.logger.error('文本提取失败:', error);
      return '';
    }
  }

  /**
   * 切分文本（按语义边界切分）
   * 优先按段落、句子边界切分，避免语义截断
   * @param text 文本内容
   * @param chunkSize 切片大小（字符数）
   * @param chunkOverlap 切片重叠（字符数）
   * @returns {string[]} 切片数组
   */
  private splitText(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
  ): string[] {
    if (!text || text.trim().length === 0) return [];

    const paragraphs = this.splitIntoParagraphs(text);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if (para.trim().length === 0) continue;

      if (currentChunk.length + para.length + 2 > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        const overlapText = this.getOverlapText(currentChunk, chunkOverlap);
        currentChunk = overlapText ? overlapText + '\n\n' + para : para;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    if (chunks.length === 0 && text.trim().length > 0) {
      chunks.push(text.trim());
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }

  /**
   * 将文本拆分为段落
   * 优先按双换行（段落分隔），其次按单换行（行分隔），最后按句子分隔
   * @param text 原始文本
   * @returns {string[]} 段落数组
   */
  private splitIntoParagraphs(text: string): string[] {
    const doubleNewlineParts = text.split(/\n{2,}/);
    const paragraphs: string[] = [];

    for (const part of doubleNewlineParts) {
      if (part.trim().length === 0) continue;

      if (part.length <= 800) {
        paragraphs.push(part.trim());
      } else {
        const subParagraphs = this.splitLongText(part);
        paragraphs.push(...subParagraphs);
      }
    }

    return paragraphs;
  }

  /**
   * 将长文本按句子边界拆分
   * 支持中英文句子分隔符
   * @param text 长文本
   * @returns {string[]} 子段落数组
   */
  private splitLongText(text: string): string[] {
    const sentenceEndings = /([。！？.!?\n])/g;
    const sentences: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      const match = sentenceEndings.exec(remaining);
      if (!match) {
        sentences.push(remaining);
        break;
      }

      const endIdx = match.index + match[0].length;
      const sentence = remaining.slice(0, endIdx);
      sentences.push(sentence);
      remaining = remaining.slice(endIdx);
      sentenceEndings.lastIndex = 0;
    }

    const result: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length > 800 && current.length > 0) {
        result.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }

    if (current.trim().length > 0) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * 获取文本末尾的重叠部分
   * 按句子边界截取，确保重叠部分语义完整
   * @param text 原始文本
   * @param overlapSize 重叠字符数
   * @returns {string} 重叠文本
   */
  private getOverlapText(text: string, overlapSize: number): string {
    if (overlapSize <= 0 || text.length <= overlapSize) return text;

    const tail = text.slice(-overlapSize);
    const sentenceBreak = tail.search(/[。！？.!?\n]/);

    if (sentenceBreak >= 0 && sentenceBreak < tail.length - 1) {
      return tail.slice(sentenceBreak + 1).trim();
    }

    return tail;
  }

  /**
   * 生成文本向量
   * @param text 文本内容
   * @returns {Promise<number[]>} 向量数组
   * @throws 当Embedding服务不可用时抛出错误，文档处理将标记为失败
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const result = await this.aiService.embedding(
        { input: text },
        '127.0.0.1',
        'document-processor',
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
      this.logger.error(`Embedding生成失败: ${error.message}`);
      throw error;
    }
  }
}
