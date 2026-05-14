import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { QueryDocumentListDto } from './dto/query-document-list.dto';
import { DeleteDocumentDto } from './dto/delete-document.dto';
import { VectorService } from '../vector/vector.service';
import { TaskService } from '../task/task.service';
import { FileService } from '../file/file.service';
import { BusinessType } from '../file/interfaces/file.interface';

/**
 * 文档管理服务
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  /**
   * 构造函数
   * @param prisma Prisma服务
   * @param vectorService 向量服务
   * @param taskService 任务服务（用于异步处理文档）
   * @param fileService 文件服务
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly taskService: TaskService,
    private readonly fileService: FileService,
  ) {}

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
    const fileExt = this.getFileExtension(file.originalname);

    if (!allowedTypes.includes(fileExt)) {
      throw new BadRequestException('不支持的文件类型');
    }

    const uploadResult = await this.fileService.upload(file, {
      businessType: BusinessType.KB,
      businessId: dto.kbId,
      storageType: 'local',
      enableDedup: true,
      appCode: dto.appCode,
      uid: dto.uid,
    });

    const doc = await this.prisma.kbDocument.create({
      data: {
        kbId: dto.kbId,
        docCode: `doc_${Date.now()}`,
        fileId: uploadResult.fileId,
        status: 0,
        createdBy: dto.uid,
      },
      include: {
        file: {
          select: {
            fileName: true,
            fileType: true,
            fileUrl: true,
            fileSize: true,
          },
        },
      },
    });

    await this.taskService.addDocumentProcessTask(
      doc.id,
      dto.kbId,
      uploadResult.fileId,
      kb,
    );

    return {
      docId: doc.id,
      docCode: doc.docCode,
      fileId: uploadResult.fileId,
      fileName: doc.file!.fileName,
      fileUrl: doc.file!.fileUrl,
      fileSize: doc.file!.fileSize,
      isDuplicate: uploadResult.isDuplicate,
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

    for (const file of files) {
      const fileExt = this.getFileExtension(file.originalname);
      const decodedFileName = this.fileService.decodeFilename(file.originalname);

      if (!allowedTypes.includes(fileExt)) {
        results.push({
          fileName: decodedFileName,
          success: false,
          message: '不支持的文件类型',
        });
        continue;
      }

      try {
        const uploadResult = await this.fileService.upload(file, {
          businessType: BusinessType.KB,
          businessId: dto.kbId,
          storageType: 'local',
          enableDedup: true,
          appCode: dto.appCode,
          uid: dto.uid,
        });

        const doc = await this.prisma.kbDocument.create({
          data: {
            kbId: dto.kbId,
            docCode: `doc_${Date.now()}`,
            fileId: uploadResult.fileId,
            status: 0,
            createdBy: dto.uid,
          },
          include: {
            file: {
              select: {
                fileName: true,
                fileType: true,
                fileUrl: true,
                fileSize: true,
              },
            },
          },
        });

        tasks.push({
          docId: doc.id,
          kbId: dto.kbId,
          fileId: uploadResult.fileId,
          kb,
        });

        results.push({
          docId: doc.id,
          docCode: doc.docCode,
          fileId: uploadResult.fileId,
          fileName: doc.file!.fileName,
          fileUrl: doc.file!.fileUrl,
          fileSize: doc.file!.fileSize,
          isDuplicate: uploadResult.isDuplicate,
          status: doc.status,
          success: true,
        });
      } catch (error) {
        results.push({
          fileName: decodedFileName,
          success: false,
          message: error.message || '上传失败',
        });
      }
    }

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
      where.file = { fileName: { contains: dto.docName } };
    }

    const [total, list] = await Promise.all([
      this.prisma.kbDocument.count({ where }),
      this.prisma.kbDocument.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          file: {
            select: {
              fileName: true,
              fileType: true,
              fileUrl: true,
              fileSize: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      list: list.map((item) => ({
        docId: item.id,
        docCode: item.docCode,
        fileName: item.file?.fileName,
        fileType: item.file?.fileType,
        fileUrl: item.file?.fileUrl,
        fileSize: item.file?.fileSize,
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
      include: { file: true },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

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

    if (doc.fileId) {
      await this.fileService.delete(doc.fileId);
    }

    return true;
  }

  /**
   * 获取文件扩展名
   * @param fileName 文件名
   * @returns {string} 扩展名（小写）
   */
  private getFileExtension(fileName: string): string {
    const decoded = this.fileService.decodeFilename(fileName);
    return decoded.split('.').pop()?.toLowerCase() || '';
  }
}
