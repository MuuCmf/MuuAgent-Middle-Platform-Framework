import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { FileService } from './file.service';
import { FileProcessService } from './file-process.service';
import { StorageService } from './storage/storage.service';
import { PrismaService } from '../common/prisma/prisma.service';
import * as path from 'path';

/**
 * 文件操作类型枚举
 */
export enum FileAction {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
  DELETE = 'delete',
  LIST = 'list',
  INFO = 'info',
  EXISTS = 'exists',
  PROCESS = 'process',
}

/**
 * 文件执行器
 * 智能体通过技能系统操作文件的执行器
 */
@Injectable()
export class FileExecutor {
  private readonly logger = new Logger(FileExecutor.name);

  /**
   * 构造函数
   * @param fileService 文件服务
   * @param fileProcessService 文件处理服务
   * @param storageService 存储服务
   * @param prisma Prisma服务
   */
  constructor(
    private readonly fileService: FileService,
    private readonly fileProcessService: FileProcessService,
    private readonly storageService: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 执行文件技能
   * @param skill 技能记录
   * @param params 操作参数，必须包含 action 字段
   * @returns 操作结果
   */
  async execute(skill: any, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const config = JSON.parse(skill.config || '{}');
    const action = (params.action as FileAction) || config.defaultAction;

    this.validateAction(action, config);

    this.logger.log(`执行文件操作: ${action}, 技能: ${skill.code}`);

    switch (action) {
      case FileAction.UPLOAD:
        return this.handleUpload(params, config);
      case FileAction.DOWNLOAD:
        return this.handleDownload(params);
      case FileAction.DELETE:
        return this.handleDelete(params);
      case FileAction.LIST:
        return this.handleList(params, config);
      case FileAction.INFO:
        return this.handleInfo(params);
      case FileAction.EXISTS:
        return this.handleExists(params);
      case FileAction.PROCESS:
        return this.handleProcess(params, config);
      default:
        throw new BadRequestException(`不支持的文件操作: ${action}`);
    }
  }

  /**
   * 验证操作权限
   * @param action 操作类型
   * @param config 技能配置
   */
  private validateAction(action: string, config: Record<string, any>): void {
    const allowed = config.allowedActions;
    if (allowed && Array.isArray(allowed) && !allowed.includes(action)) {
      throw new BadRequestException(`该技能不允许执行 ${action} 操作`);
    }
  }

  /**
   * 验证路径安全性
   * @param filePath 文件路径
   */
  private validatePath(filePath: string): void {
    const normalized = path.normalize(filePath);
    if (normalized.includes('..') || filePath.includes('..')) {
      throw new BadRequestException('非法文件路径');
    }
  }

  /**
   * 检查存储配额
   * @param appCode 应用标识
   * @param config 技能配置
   */
  private async checkQuota(appCode: string, config: Record<string, any>): Promise<void> {
    if (!config.maxStorage) return;

    const result = await this.prisma.file.aggregate({
      where: { appCode, deletedAt: null },
      _sum: { fileSize: true },
    });

    const used = result._sum.fileSize || 0;
    if (used >= config.maxStorage) {
      throw new BadRequestException('存储空间已满');
    }
  }

  /**
   * 处理文件上传
   * @param params 参数
   * @param config 配置
   * @returns 上传结果
   */
  private async handleUpload(
    params: Record<string, unknown>,
    config: Record<string, any>,
  ): Promise<Record<string, unknown>> {
    const { fileName, fileContent, businessId } = params;

    if (!fileName || !fileContent) {
      throw new BadRequestException('fileName 和 fileContent 不能为空');
    }

    const buffer = Buffer.from(fileContent as string, 'base64');

    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: fileName as string,
      encoding: '7bit',
      mimetype: this.getMimeType(fileName as string),
      buffer,
      size: buffer.length,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const result = await this.fileService.upload(file, {
      businessType: config.businessType || 'agent',
      businessId: businessId as string,
      maxSize: config.maxFileSize,
      allowedTypes: config.allowedTypes,
      deniedExtensions: config.deniedExtensions,
      appCode: config.appCode,
    });

    return {
      fileId: result.fileId,
      fileUrl: result.fileUrl,
      isDuplicate: result.isDuplicate,
    };
  }

  /**
   * 处理文件下载
   * @param params 参数
   * @returns 下载结果
   */
  private async handleDownload(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { fileId } = params;

    if (!fileId) {
      throw new BadRequestException('fileId 不能为空');
    }

    const result = await this.fileService.download(fileId as string);

    return {
      fileName: result.fileName,
      mimeType: result.mimeType,
      fileSize: result.fileSize,
      fileUrl: `/file/download/${fileId}`,
    };
  }

  /**
   * 处理文件删除
   * @param params 参数
   * @returns 删除结果
   */
  private async handleDelete(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { fileId, permanent } = params;

    if (!fileId) {
      throw new BadRequestException('fileId 不能为空');
    }

    await this.fileService.delete(fileId as string, (permanent as boolean) || false);
    return { success: true, message: '文件已删除' };
  }

  /**
   * 处理文件列表查询
   * @param params 参数
   * @param config 配置
   * @returns 文件列表
   */
  private async handleList(
    params: Record<string, unknown>,
    config: Record<string, any>,
  ): Promise<Record<string, unknown>> {
    const { page, pageSize, fileType, fileName } = params;

    const result = await this.fileService.findAll(
      {
        page: (page as number) || 1,
        pageSize: (pageSize as number) || 20,
        fileType: fileType as string,
        fileName: fileName as string,
        businessType: config.businessType,
      },
      config.appCode,
    );

    return result as any;
  }

  /**
   * 处理文件信息查询
   * @param params 参数
   * @returns 文件信息
   */
  private async handleInfo(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { fileId } = params;

    if (!fileId) {
      throw new BadRequestException('fileId 不能为空');
    }

    const file = await this.fileService.findOne(fileId as string);
    return file;
  }

  /**
   * 处理文件存在检查
   * @param params 参数
   * @returns 存在性结果
   */
  private async handleExists(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { fileId } = params;

    if (!fileId) {
      throw new BadRequestException('fileId 不能为空');
    }

    try {
      const file = await this.fileService.findOne(fileId as string);
      return { exists: true, file };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * 处理文件处理任务
   * @param params 参数
   * @param config 配置
   * @returns 处理结果
   */
  private async handleProcess(
    params: Record<string, unknown>,
    config: Record<string, any>,
  ): Promise<Record<string, unknown>> {
    const { fileId, processType, options } = params;

    if (!fileId || !processType) {
      throw new BadRequestException('fileId 和 processType 不能为空');
    }

    const allowedProcessTypes = config.allowedProcessTypes;
    if (allowedProcessTypes && !allowedProcessTypes.includes(processType)) {
      throw new BadRequestException(`不允许的处理类型: ${processType}`);
    }

    const taskId = await this.fileProcessService.addTask(fileId as string, {
      type: processType as string,
      options: options as Record<string, any>,
    });

    await this.fileProcessService.executeTask(taskId);

    const taskResult = await this.fileProcessService.getTaskStatus(taskId);
    return {
      taskId,
      status: (taskResult as any)?.status,
      result: (taskResult as any)?.result ? JSON.parse((taskResult as any).result) : null,
    };
  }

  /**
   * 根据文件名获取 MIME 类型
   * @param fileName 文件名
   * @returns MIME 类型
   */
  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.csv': 'text/csv',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }
}
