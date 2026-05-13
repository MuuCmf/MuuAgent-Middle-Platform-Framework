import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { QueryDocumentListDto } from './dto/query-document-list.dto';
import { DeleteDocumentDto } from './dto/delete-document.dto';
import { VectorService } from '../vector/vector.service';
import { TaskService } from '../task/task.service';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

/**
   * 文档管理服务
   */
@Injectable()
export class DocumentService {
  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param vectorService 向量服务
   * @param taskService 任务服务（用于异步处理文档）
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly taskService: TaskService,
  ) {}

  /**
   * 解码中文文件名（处理双重编码问题）
   * 当浏览器上传中文文件时，文件名可能经历 UTF-8 -> Latin-1 -> UTF-8 的错误转换
   * 例如：中文.txt → è¾_test.txt（UTF-8字节被错误解释为Latin-1）
   * @param fileName 原始文件名
   * @returns {string} 解码后的文件名
   */
  private decodeFileName(fileName: string): string {
    try {
      // 先尝试标准的 URL 解码
      const decoded = decodeURIComponent(fileName);
      
      // 如果解码后包含有效中文，直接返回
      if (/[\u4e00-\u9fa5]/.test(decoded)) {
        return decoded;
      }
    } catch {}
    
    // URL解码后没有中文，可能是双重编码问题
    // 将字符串按 Latin-1 转换为 Buffer，再按 UTF-8 解码
    try {
      const buffer = Buffer.from(fileName, 'latin1');
      const fixed = buffer.toString('utf-8');
      
      // 如果修复后包含中文，返回修复后的结果
      if (/[\u4e00-\u9fa5]/.test(fixed)) {
        return fixed;
      }
    } catch {}
    
    // 所有方法都失败，返回原始文件名
    return fileName;
  }

  /**
   * 上传文档
   * @param dto 上传参数
   * @param file 文件对象
   * @returns {Promise<any>} 上传结果
   */
  async upload(dto: UploadDocumentDto, file: Express.Multer.File): Promise<any> {
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'md'];
    
    // 解码中文文件名
    const decodedFileName = this.decodeFileName(file.originalname);
    const fileExt = path.extname(decodedFileName).toLowerCase().replace('.', '');

    if (!allowedTypes.includes(fileExt)) {
      throw new BadRequestException('不支持的文件类型');
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'kb', dto.kbId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // 使用 UUID 作为存储文件名，避免中文文件名兼容性问题和 URL 过长
    const storageFileName = `${Date.now()}_${uuidv4()}.${fileExt}`;
    const filePath = path.join(uploadDir, storageFileName);
    fs.writeFileSync(filePath, file.buffer);

    const doc = await this.prisma.kbDocument.create({
      data: {
        kbId: dto.kbId,
        docName: decodedFileName,
        docCode: `doc_${Date.now()}`,
        fileType: fileExt,
        fileUrl: `/uploads/kb/${dto.kbId}/${storageFileName}`,
        fileSizeKb: Math.ceil(file.size / 1024),
        status: 0,
        createdBy: dto.uid,
      },
    });

    // 将文档处理任务添加到异步队列
    await this.taskService.addDocumentProcessTask(doc.id, dto.kbId, filePath, kb);

    return {
      docId: doc.id,
      docName: doc.docName,
      fileType: doc.fileType,
      fileUrl: doc.fileUrl,
      status: doc.status,
    };
  }

  /**
   * 批量上传文档
   * @param dto 上传参数
   * @param files 文件对象列表
   * @returns {Promise<any>} 上传结果
   */
  async batchUpload(dto: UploadDocumentDto, files: Express.Multer.File[]): Promise<any> {
    const kb = await this.prisma.kbInfo.findFirst({
      where: { id: dto.kbId, isDeleted: false },
    });

    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'md'];
    const results = [];
    const tasks = [];

    const uploadDir = path.join(process.cwd(), 'uploads', 'kb', dto.kbId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      // 解码中文文件名
      const decodedFileName = this.decodeFileName(file.originalname);
      const fileExt = path.extname(decodedFileName).toLowerCase().replace('.', '');

      if (!allowedTypes.includes(fileExt)) {
        results.push({
          docName: decodedFileName,
          success: false,
          message: '不支持的文件类型',
        });
        continue;
      }

      // 使用 UUID 作为存储文件名，避免中文文件名兼容性问题和 URL 过长
      const storageFileName = `${Date.now()}_${uuidv4()}.${fileExt}`;
      const filePath = path.join(uploadDir, storageFileName);
      fs.writeFileSync(filePath, file.buffer);

      const doc = await this.prisma.kbDocument.create({
        data: {
          kbId: dto.kbId,
          docName: decodedFileName,
          docCode: `doc_${Date.now()}`,
          fileType: fileExt,
          fileUrl: `/uploads/kb/${dto.kbId}/${storageFileName}`,
          fileSizeKb: Math.ceil(file.size / 1024),
          status: 0,
          createdBy: dto.uid,
        },
      });

      // 添加到任务列表
      tasks.push({
        docId: doc.id,
        kbId: dto.kbId,
        filePath,
        kb,
      });

      results.push({
        docId: doc.id,
        docName: doc.docName,
        fileType: doc.fileType,
        fileUrl: doc.fileUrl,
        status: doc.status,
        success: true,
      });
    }

    // 批量添加任务到队列
    await this.taskService.addBatchDocumentProcessTask(tasks);

    return results;
  }

  /**
   * 查询文档列表
   * @param dto 查询参数
   * @returns {Promise<any>} 查询结果
   */
  async findAll(dto: QueryDocumentListDto): Promise<any> {
    const pageNum = dto.pageNum || 1;
    const pageSize = dto.pageSize || 10;
    const skip = (pageNum - 1) * pageSize;

    const where: any = {
      kbId: dto.kbId,
      isDeleted: false,
    };

    if (dto.docName) {
      where.docName = { contains: dto.docName };
    }

    const [total, list] = await Promise.all([
      this.prisma.kbDocument.count({ where }),
      this.prisma.kbDocument.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          docName: true,
          fileType: true,
          fileSizeKb: true,
          status: true,
          totalChunks: true,
          createdAt: true,
          createdBy: true,
        },
      }),
    ]);

    return {
      total,
      list: list.map((item) => ({
        docId: item.id,
        docName: item.docName,
        fileType: item.fileType,
        fileSizeKb: item.fileSizeKb,
        status: item.status,
        totalChunks: item.totalChunks,
        createdTime: item.createdAt,
        createdBy: item.createdBy,
      })),
      pageNum,
      pageSize,
    };
  }

  /**
   * 删除文档（软删除）
   * @param dto 删除参数
   * @returns {Promise<any>} 删除结果
   */
  async delete(dto: DeleteDocumentDto): Promise<any> {
    const doc = await this.prisma.kbDocument.findFirst({
      where: { id: dto.docId, kbId: dto.kbId, isDeleted: false },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 删除向量库中的向量
    await this.vectorService.deleteByDocId(dto.docId);

    await this.prisma.kbDocument.update({
      where: { id: dto.docId },
      data: {
        isDeleted: true,
        updatedBy: dto.uid,
      },
    });

    await this.prisma.kbChunk.updateMany({
      where: { docId: dto.docId },
      data: { isDeleted: true },
    });

    return true;
  }

  /**
   * 日志记录器
   */
  private logger = {
    log: (...args: any[]) => console.log('[DocumentService]', ...args),
    error: (...args: any[]) => console.error('[DocumentService]', ...args),
  };
}
