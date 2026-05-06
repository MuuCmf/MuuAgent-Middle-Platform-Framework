import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

/**
 * 任务服务
 * 提供任务队列操作接口
 */
@Injectable()
export class TaskService {
  /**
   * 构造函数
   * @param documentQueue 文档处理队列
   */
  constructor(@InjectQueue('document') private documentQueue: Queue) {}

  /**
   * 添加文档处理任务到队列
   * @param docId 文档ID
   * @param kbId 知识库ID
   * @param filePath 文件路径
   * @param kb 知识库信息
   * @returns {Promise<void>}
   */
  async addDocumentProcessTask(
    docId: string,
    kbId: string,
    filePath: string,
    kb: any,
  ): Promise<void> {
    await this.documentQueue.add('process-document', {
      docId,
      kbId,
      filePath,
      kb,
    });
  }

  /**
   * 添加批量文档处理任务到队列
   * @param documents 文档列表
   * @returns {Promise<void>}
   */
  async addBatchDocumentProcessTask(documents: Array<{
    docId: string;
    kbId: string;
    filePath: string;
    kb: any;
  }>): Promise<void> {
    for (const doc of documents) {
      await this.documentQueue.add('process-document', doc);
    }
  }

  /**
   * 获取队列状态
   * @returns {Promise<any>} 队列状态信息
   */
  async getQueueStatus(): Promise<any> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.documentQueue.getWaitingCount(),
      this.documentQueue.getActiveCount(),
      this.documentQueue.getCompletedCount(),
      this.documentQueue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
    };
  }

  /**
   * 清空队列
   * @returns {Promise<void>}
   */
  async clearQueue(): Promise<void> {
    await this.documentQueue.empty();
  }

  /**
   * 重试失败任务
   * @returns {Promise<void>}
   */
  async retryFailedJobs(): Promise<void> {
    const failedJobs = await this.documentQueue.getFailed();
    for (const job of failedJobs) {
      await job.retry();
    }
  }
}
