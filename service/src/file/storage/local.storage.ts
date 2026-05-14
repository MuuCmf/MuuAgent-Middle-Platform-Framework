import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { StorageEngine, StorageResult } from '../interfaces/storage.interface';

/**
 * 本地存储引擎
 */
@Injectable()
export class LocalStorage implements StorageEngine {
  private readonly logger = new Logger(LocalStorage.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('FILE_UPLOAD_DIR', './uploads');
    this.baseUrl = this.configService.get<string>('FILE_BASE_URL', '/uploads');
  }

  /**
   * 存储文件
   * @param buffer 文件缓冲区
   * @param filePath 存储路径
   * @returns 存储结果
   */
  async store(buffer: Buffer, filePath: string): Promise<StorageResult> {
    const fullPath = path.join(this.uploadDir, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, buffer);
    this.logger.debug(`文件已存储: ${fullPath}`);

    return {
      storageName: path.basename(filePath),
      filePath,
      fileUrl: `${this.baseUrl}/${filePath}`,
    };
  }

  /**
   * 获取文件
   * @param filePath 存储路径
   * @returns 文件流
   */
  async retrieve(filePath: string): Promise<NodeJS.ReadableStream> {
    const fullPath = path.join(this.uploadDir, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('文件不存在');
    }

    return fs.createReadStream(fullPath);
  }

  /**
   * 删除文件
   * @param filePath 存储路径
   */
  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      this.logger.debug(`文件已删除: ${fullPath}`);
    }
  }

  /**
   * 检查文件是否存在
   * @param filePath 存储路径
   */
  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.uploadDir, filePath);
    return fs.existsSync(fullPath);
  }

  /**
   * 获取文件URL
   * @param filePath 存储路径
   */
  async getUrl(filePath: string): Promise<string> {
    return `${this.baseUrl}/${filePath}`;
  }
}
