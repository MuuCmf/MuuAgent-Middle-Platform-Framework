import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import { ImageProcessor } from './processor/image.processor';

/**
 * 文件处理服务
 */
@Injectable()
export class FileProcessService {
  private readonly logger = new Logger(FileProcessService.name);
  private readonly processors: Map<string, any> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly imageProcessor: ImageProcessor,
  ) {
    this.processors.set('image', imageProcessor);
  }

  /**
   * 添加处理任务
   * @param fileId 文件ID
   * @param config 处理配置
   * @returns 任务ID
   */
  async addTask(
    fileId: string,
    config: { type: string; options?: Record<string, any> },
  ): Promise<string> {
    const task = await this.prisma.fileProcessTask.create({
      data: {
        fileId: fileId as any,
        taskType: config.type,
        taskConfig: JSON.stringify(config.options || {}),
        status: 'pending',
      },
    });

    this.logger.log(`创建处理任务: ${task.id}, 类型: ${config.type}`);
    return task.id as any;
  }



  /**
   * 执行处理任务
   * @param taskId 任务ID
   */
  async executeTask(taskId: string): Promise<void> {
    const task = await this.prisma.fileProcessTask.findUnique({
      where: { id: taskId as any },
      include: { file: true },
    });

    if (!task || !(task.file as any).id) {
      this.logger.error(`任务不存在: ${taskId}`);
      return;
    }

    await this.prisma.fileProcessTask.update({
      where: { id: taskId as any },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });

    const startTime = Date.now();

    try {
      const file = task.file as any;
      const processor = this.processors.get(file.fileType);

      if (!processor) {
        throw new Error(`不支持的文件类型: ${file.fileType}`);
      }

      const config = JSON.parse(task.taskConfig);
      const result = await processor.process(file, task.taskType, config);

      await this.prisma.fileProcessTask.update({
        where: { id: taskId as any },
        data: {
          status: 'completed',
          progress: 100,
          result: JSON.stringify(result),
          completedAt: new Date(),
          costMs: Date.now() - startTime,
        },
      });

      await this.prisma.file.update({
        where: { id: file.id },
        data: {
          isProcessed: true,
          processResult: JSON.stringify(result),
        },
      });

      this.logger.log(`任务执行成功: ${taskId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '处理失败';

      await this.prisma.fileProcessTask.update({
        where: { id: taskId as any },
        data: {
          status: 'failed',
          errorMessage,
          completedAt: new Date(),
          costMs: Date.now() - startTime,
        },
      });

      this.logger.error(`任务执行失败: ${taskId}, 错误: ${errorMessage}`);
    }
  }

  /**
   * 获取待处理任务
   * @param limit 数量限制
   * @returns 任务列表
   */
  async getPendingTasks(limit: number = 10) {
    return this.prisma.fileProcessTask.findMany({
      where: {
        status: 'pending',
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' },
      ],
      take: limit,
    });
  }

  /**
   * 重试失败任务
   * @param taskId 任务ID
   */
  async retryTask(taskId: string): Promise<void> {
    const task = await this.prisma.fileProcessTask.findUnique({
      where: { id: taskId as any },
    });

    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.retryCount >= task.maxRetries) {
      throw new Error('已达到最大重试次数');
    }

    await this.prisma.fileProcessTask.update({
      where: { id: taskId as any },
      data: {
        status: 'pending',
        retryCount: { increment: 1 },
        errorMessage: null,
      },
    });

    this.logger.log(`任务已重试: ${taskId}`);
  }

  /**
   * 获取任务状态
   * @param taskId 任务ID
   * @returns 任务信息
   */
  async getTaskStatus(taskId: string) {
    return this.prisma.fileProcessTask.findUnique({
      where: { id: taskId as any },
    });
  }
}
