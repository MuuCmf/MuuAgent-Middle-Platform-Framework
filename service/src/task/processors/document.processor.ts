import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VectorService } from '../../vector/vector.service';
import { AiService } from '../../ai/ai.service';
import { FileService } from '../../file/file.service';
import { v4 as uuidv4 } from 'uuid';
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
        where: { id: docId },
        data: { status: 1 },
      });

      const content = await this.extractTextFromFile(fileId);
      const chunks = this.splitText(content, kb.chunkSize, kb.chunkOverlap);

      await this.prisma.kbDocument.update({
        where: { id: docId },
        data: { totalChunks: chunks.length },
      });

      const kbInfo = await this.prisma.kbInfo.findFirst({
        where: { id: kbId, isDeleted: false },
        select: { retrievalMethod: true },
      });
      const retrievalMethod = kbInfo?.retrievalMethod || 'vector';

      if (retrievalMethod === 'vector') {
        const vectorPayloads = [];
        const vectors: number[][] = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunkId = uuidv4();

          await this.prisma.kbChunk.create({
            data: {
              id: chunkId,
              kbId,
              docId,
              content: chunks[i],
              chunkIndex: i,
              status: 0,
            },
          });

          const embeddingResult = await this.generateEmbedding(chunks[i]);
          vectors.push(embeddingResult);

          vectorPayloads.push({
            kb_id: kbId,
            doc_id: docId,
            chunk_id: chunkId,
            chunk_index: i,
            content: chunks[i],
            doc_name: kbId,
            kb_name: kb.kbName || '',
          });
        }

        if (vectors.length > 0) {
          await this.vectorService.insertVectors(vectors, vectorPayloads);
          this.logger.log(`文档 ${docId} 的 ${vectors.length} 个向量已写入 Qdrant`);
        }
      } else {
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = uuidv4();

          await this.prisma.kbChunk.create({
            data: {
              id: chunkId,
              kbId,
              docId,
              content: chunks[i],
              chunkIndex: i,
              status: 1,
            },
          });
        }
        this.logger.log(`文档 ${docId} 使用BM25检索方式，跳过向量生成`);
      }

      await this.prisma.kbChunk.updateMany({
        where: { docId },
        data: { status: 1 },
      });

      await this.prisma.kbDocument.update({
        where: { id: docId },
        data: { status: 1 },
      });

      this.logger.log(`文档处理完成: ${docId}, 切片数: ${chunks.length}`);
    } catch (error) {
      this.logger.error(`文档处理失败 ${docId}:`, error);
      await this.prisma.kbDocument.update({
        where: { id: docId },
        data: { status: 2 },
      });
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
   * 切分文本
   * @param text 文本内容
   * @param chunkSize 切片大小
   * @param chunkOverlap 切片重叠
   * @returns {string[]} 切片数组
   */
  private splitText(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
  ): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = start + chunkSize;
      const chunk = text.slice(start, end);
      chunks.push(chunk.trim());
      start = end - chunkOverlap;
    }

    return chunks.filter((chunk) => chunk.length > 0);
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
        this.logger.warn('Embedding服务不可用，使用随机向量');
        return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
      }
    } catch (error) {
      this.logger.warn('Embedding生成失败，使用随机向量:', error.message);
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
  }
}
