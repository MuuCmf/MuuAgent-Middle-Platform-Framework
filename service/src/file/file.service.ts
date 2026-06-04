import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import * as crypto from 'crypto';
import * as path from 'path';
import { UploadOptions, FileUploadResult, FileDownloadResult, FileListResult } from './interfaces/file.interface';

/**
 * 文件服务
 */
@Injectable()
export class FileService {
  /** 日志记录器 */
  private readonly logger = new Logger(FileService.name);
  /** 最大文件大小限制（默认 50MB） */
  private readonly maxFileSize: number;
  /** 允许上传的文件类型列表 */
  private readonly allowedTypes: string[];
  /** 禁止上传的文件扩展名列表 */
  private readonly deniedExtensions: string[];

  /**
   * 构造函数
   * @param prisma Prisma 数据库服务
   * @param storageService 存储服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {
    /** 默认最大文件大小 50MB */
    this.maxFileSize = 50 * 1024 * 1024;
    /** 默认允许的文件类型 */
    this.allowedTypes = ['image', 'video', 'audio', 'pdf', 'doc', 'txt', 'zip'];
    /** 默认禁止的可执行文件扩展名 */
    this.deniedExtensions = ['.exe', '.bat', '.sh', '.cmd', '.js', '.vbs'];
  }

  /**
   * 解码文件名（修复中文乱码）
   * 处理双重编码问题：当浏览器上传中文文件时，文件名可能经历 UTF-8 -> Latin-1 -> UTF-8 的错误转换
   * @param filename 原始文件名
   * @returns 解码后的文件名
   */
  decodeFilename(filename: string): string {
    try {
      const decoded = decodeURIComponent(filename);
      if (/[\u4e00-\u9fa5]/.test(decoded)) {
        return decoded;
      }
    } catch {}

    try {
      const buffer = Buffer.from(filename, 'latin1');
      const fixed = buffer.toString('utf8');
      if (/[\u4e00-\u9fa5]/.test(fixed)) {
        return fixed;
      }
    } catch {}

    return filename;
  }

  /**
   * 上传文件
   * @param file 文件对象
   * @param options 上传选项
   * @returns 文件信息
   */
  async upload(
    file: Express.Multer.File,  /** 上传的文件对象 */
    options: UploadOptions,  /** 上传选项 */
  ): Promise<FileUploadResult> {
    /** 解码后的文件名 */
    const decodedName = this.decodeFilename(file.originalname);
    this.logger.log(`上传文件: ${decodedName}, 大小: ${file.size} bytes`);

    this.validateFile(file, options);

    /** 文件 MD5 哈希值（用于去重） */
    const fileHash = this.calculateHash(file.buffer);

    if (options.enableDedup) {
      /** 根据哈希查找是否已存在相同文件 */
      const existingFile = await this.findByHash(fileHash, options.appCode, options.uid);
      if (existingFile) {
        this.logger.log(`文件已存在，返回已有记录: ${existingFile.id}`);
        return {
          fileId: existingFile.id,
          fileUrl: existingFile.fileUrl,
          isDuplicate: true,
        };
      }
    }

    /** 生成存储路径 */
    const storagePath = this.generateStoragePath(file, options);

    /** 存储文件到目标存储 */
    const storageResult = await this.storageService.store(
      file.buffer,
      storagePath,
      options.storageType || 'local',
    );

    /** 创建文件数据库记录 */
    const fileRecord = await this.prisma.file.create({
      data: {
        uid: options.uid,
        fileName: this.decodeFilename(file.originalname),
        storageName: storageResult.storageName,
        filePath: storageResult.filePath,
        fileUrl: storageResult.fileUrl,
        fileType: this.getFileType(file.mimetype),
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash,
        storageType: options.storageType || 'local',
        businessType: options.businessType || 'temp',
        businessId: options.businessId as any,
        isPublic: options.isPublic || false,
        appCode: options.appCode,
        createdBy: options.uid,
      },
    });

    this.logger.log(`文件上传成功: ${fileRecord.id}`);

    return {
      fileId: fileRecord.id,
      fileUrl: fileRecord.fileUrl,
      isDuplicate: false,
    };
  }

  /**
   * 批量上传文件
   * @param files 文件数组
   * @param options 上传选项
   * @returns 文件信息数组
   */
  async uploadMultiple(
    files: Express.Multer.File[],
    options: UploadOptions,
  ): Promise<FileUploadResult[]> {
    const results: FileUploadResult[] = [];

    for (const file of files) {
      const result = await this.upload(file, options);
      results.push(result);
    }

    return results;
  }

  /**
   * 下载文件
   * @param fileId 文件ID
   * @returns 文件流
   */
  async download(fileId: string): Promise<FileDownloadResult> {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId as any, deletedAt: null },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    await this.prisma.file.update({
      where: { id: fileId as any },
      data: { accessCount: { increment: 1 } },
    });

    const stream = await this.storageService.retrieve(
      file.filePath,
      file.storageType,
    );

    return {
      stream,
      fileName: file.fileName,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
    };
  }

  /**
   * 删除文件
   * @param fileId 文件ID
   * @param permanent 是否永久删除
   */
  async delete(fileId: string, permanent: boolean = false): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId as any },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    if (permanent) {
      await this.storageService.delete(file.filePath, file.storageType);
      await this.prisma.file.delete({ where: { id: fileId as any } });
      this.logger.log(`文件已永久删除: ${fileId}`);
    } else {
      await this.prisma.file.update({
        where: { id: fileId as any },
        data: { deletedAt: new Date() },
      });
      this.logger.log(`文件已软删除: ${fileId}`);
    }
  }

  /**
   * 查询文件列表（支持用户数据隔离）
   * @param query 查询参数（业务类型、业务ID、文件类型、文件名、分页）
   * @param appCode 应用标识
   * @param uid 用户唯一标识（用于数据隔离，未登录时只返回公开文件）
   * @returns 文件列表及分页信息
   */
  async findAll(
    query: { businessType?: string; businessId?: string; fileType?: string; fileName?: string; page?: number; pageSize?: number },
    appCode?: string,
    uid?: string,
  ): Promise<FileListResult> {
    const { businessType, businessId, fileType, fileName, page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {
      deletedAt: null,
    };

    if (appCode) {
      where.appCode = appCode;
    }
    if (uid) {
      // 用户数据隔离：自己的文件全部可见 + 他人的公开文件也可见
      where.OR = [
        { uid },
        { isPublic: true },
      ];
    } else {
      // 未登录只可见公开文件
      where.isPublic = true;
    }
    if (businessType) {
      where.businessType = businessType;
    }
    if (businessId) {
      where.businessId = businessId;
    }
    if (fileType) {
      where.fileType = fileType;
    }
    if (fileName) {
      where.fileName = { contains: fileName };
    }

    const [list, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取文件详情
   * @param fileId 文件ID
   * @returns 文件信息
   */
  async findOne(fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId as any, deletedAt: null },
      include: {
        processTasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    return file;
  }

  /**
   * 验证文件
   * @param file 文件对象
   * @param options 上传选项
   */
  private validateFile(file: Express.Multer.File, options: UploadOptions): void {
    const maxSize = options.maxSize || this.maxFileSize;
    if (file.size > maxSize) {
      throw new BadRequestException(`文件大小超过限制: ${maxSize / 1024 / 1024}MB`);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (this.deniedExtensions.includes(ext)) {
      throw new BadRequestException(`不允许上传的文件类型: ${ext}`);
    }

    if (options.deniedExtensions?.includes(ext)) {
      throw new BadRequestException(`不允许上传的文件类型: ${ext}`);
    }

    if (options.allowedTypes && options.allowedTypes.length > 0) {
      const fileType = this.getFileType(file.mimetype);
      if (!options.allowedTypes.includes(fileType)) {
        throw new BadRequestException(`不允许的文件类型: ${fileType}`);
      }
    }
  }

  /**
   * 计算文件哈希
   * @param buffer 文件缓冲区
   * @returns MD5哈希值
   */
  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * 根据哈希查找文件（用于去重）
   * @param hash 文件MD5哈希值
   * @param appCode 应用标识
   * @param uid 用户唯一标识（仅在同用户范围内去重）
   * @returns 文件记录或 null
   */
  private async findByHash(hash: string, appCode?: string, uid?: string) {
    const where: any = { fileHash: hash, deletedAt: null };
    if (appCode) {
      where.appCode = appCode;
    }
    if (uid) {
      where.uid = uid;
    }
    return this.prisma.file.findFirst({ where });
  }

  /**
   * 生成存储路径
   * @param file 文件对象
   * @param options 上传选项
   * @returns 存储路径（格式: {businessType}/{businessId}/{year}/{month}/{day}/{randomName}{ext}）
   */
  private generateStoragePath(file: Express.Multer.File, options: UploadOptions): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const ext = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');

    const businessPath = options.businessType || 'common';
    const businessIdPath = options.businessId || 'default';

    return `${businessPath}/${businessIdPath}/${year}/${month}/${day}/${randomName}${ext}`;
  }

  /**
   * 获取文件类型（根据 MIME 类型映射到业务分类）
   * @param mimeType MIME类型
   * @returns 文件类型: image/video/audio/pdf/doc/excel/txt/zip/md/other
   */
  private getFileType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('docx')) return 'doc';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
    if (mimeType.startsWith('text/')) return 'txt';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'zip';
    if (mimeType.includes('markdown') || mimeType === 'text/markdown') return 'md';
    return 'other';
  }
}
