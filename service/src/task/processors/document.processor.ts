import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VectorService } from '../../vector/vector.service';
import { AiService } from '../../ai/ai.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';

/**
 * 文档处理处理器
 * 负责异步处理文档切片和向量生成
 */
@Processor('document')
export class DocumentProcessor {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param vectorService 向量服务
   * @param aiService AI服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly aiService: AiService,
  ) {}

  /**
   * 处理文档任务
   * @param job 任务对象
   */
  @Process('process-document')
  async handleProcessDocument(job: Job<{
    docId: string;
    kbId: string;
    filePath: string;
    kb: any;
  }>) {
    const { docId, kbId, filePath, kb } = job.data;

    try {
      // 更新文档状态为处理中
      await this.prisma.kbDocument.update({
        where: { id: docId },
        data: { status: 1 },
      });

      // 提取文本内容
      const content = await this.extractText(filePath);
      const chunks = this.splitText(content, kb.chunkSize, kb.chunkOverlap);

      // 更新文档切片数量
      await this.prisma.kbDocument.update({
        where: { id: docId },
        data: { totalChunks: chunks.length },
      });

      // 获取知识库配置的检索方式
      const kbInfo = await this.prisma.kbInfo.findFirst({
        where: { id: kbId, isDeleted: false },
        select: { retrievalMethod: true },
      });
      const retrievalMethod = kbInfo?.retrievalMethod || 'vector';

      // 如果配置为向量检索，则生成并写入向量
      if (retrievalMethod === 'vector') {
        // 批量创建切片记录并生成向量
        const vectorPayloads = [];
        const vectors: number[][] = [];

        for (let i = 0; i < chunks.length; i++) {
          const chunkId = uuidv4();

          // 创建切片记录
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

          // 生成向量
          const embeddingResult = await this.generateEmbedding(chunks[i]);
          vectors.push(embeddingResult);

          // 准备向量payload
          vectorPayloads.push({
            kb_id: kbId,
            doc_id: docId,
            chunk_id: chunkId,
            chunk_index: i,
            content: chunks[i],
            doc_name: kbId, // 将在写入时从数据库获取
            kb_name: kb.kbName || '',
          });
        }

        // 批量将向量写入 Qdrant
        if (vectors.length > 0) {
          await this.vectorService.insertVectors(vectors, vectorPayloads);
          console.log(`[DocumentProcessor] 文档 ${docId} 的 ${vectors.length} 个向量已写入 Qdrant`);
        }
      } else {
        // BM25检索方式：只创建切片记录，不生成向量
        for (let i = 0; i < chunks.length; i++) {
          const chunkId = uuidv4();

          // 创建切片记录（状态直接设为已完成）
          await this.prisma.kbChunk.create({
            data: {
              id: chunkId,
              kbId,
              docId,
              content: chunks[i],
              chunkIndex: i,
              status: 1, // BM25模式直接设为已完成
            },
          });
        }
        console.log(`[DocumentProcessor] 文档 ${docId} 使用BM25检索方式，跳过向量生成`);
      }

      // 更新所有切片状态为已向量化
      await this.prisma.kbChunk.updateMany({
        where: { docId },
        data: { status: 1 },
      });

      // 更新文档状态为完成
      await this.prisma.kbDocument.update({
        where: { id: docId },
        data: { status: 1 },
      });

      console.log(`[DocumentProcessor] 文档处理完成: ${docId}, 切片数: ${chunks.length}`);
    } catch (error) {
      console.error(`[DocumentProcessor] 文档处理失败 ${docId}:`, error);
      await this.prisma.kbDocument.update({
        where: { id: docId },
        data: { status: 2 },
      });
      throw error;
    }
  }

  /**
   * 检测字符串是否包含乱码字符
   * @param str 字符串
   * @returns {boolean} 是否包含乱码
   */
  private containsGarbledChars(str: string): boolean {
    // 检测替换字符（UTF-8解码失败时产生）
    const replacementCharCount = (str.match(/\uFFFD/g) || []).length;
    // 如果替换字符占比超过5%，认为是编码错误
    return replacementCharCount > str.length * 0.05;
  }

  /**
   * 提取文本内容（支持GBK/GB2312/UTF-8编码自动检测）
   * @param filePath 文件路径
   * @returns {Promise<string>} 文本内容
   */
  private async extractText(filePath: string): Promise<string> {
    try {
      // 先读取原始字节
      const buffer = fs.readFileSync(filePath);
      
      // 先尝试按UTF-8解码
      let content = buffer.toString('utf-8');
      
      // 检测是否包含乱码字符
      if (this.containsGarbledChars(content)) {
        // UTF-8解码失败，尝试GBK解码
        try {
          content = iconv.decode(buffer, 'GBK');
          console.log(`[DocumentProcessor] 文件 ${filePath} 使用GBK编码解码`);
        } catch (gbkError) {
          // GBK解码也失败，尝试GB2312
          try {
            content = iconv.decode(buffer, 'GB2312');
            console.log(`[DocumentProcessor] 文件 ${filePath} 使用GB2312编码解码`);
          } catch (gb2312Error) {
            console.warn(`[DocumentProcessor] 文件 ${filePath} 编码检测失败，使用原始UTF-8内容`);
          }
        }
      }
      
      return content;
    } catch (error) {
      console.error('文本提取失败:', error);
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
        console.warn('Embedding服务不可用，使用随机向量');
        return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
      }
    } catch (error) {
      console.warn('Embedding生成失败，使用随机向量:', error.message);
      return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
    }
  }
}
