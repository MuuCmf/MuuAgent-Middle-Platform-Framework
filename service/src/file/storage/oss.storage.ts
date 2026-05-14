import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { StorageEngine, StorageResult } from '../interfaces/storage.interface';

/**
 * 阿里云 OSS 存储引擎
 */
@Injectable()
export class OssStorage implements StorageEngine {
  private readonly logger = new Logger(OssStorage.name);
  private readonly bucket: string;
  private readonly cdnUrl?: string;
  private ossClient: any;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('OSS_BUCKET', '');
    this.cdnUrl = this.configService.get<string>('OSS_CDN_URL');

    const region = this.configService.get<string>('OSS_REGION', '');
    const accessKeyId = this.configService.get<string>('OSS_ACCESS_KEY_ID', '');
    const accessKeySecret = this.configService.get<string>('OSS_ACCESS_KEY_SECRET', '');

    if (accessKeyId && accessKeySecret && this.bucket && region) {
      const OSS = require('ali-oss');
      this.ossClient = new OSS({
        region,
        accessKeyId,
        accessKeySecret,
        bucket: this.bucket,
        secure: true,
      });
    }
  }

  /**
   * 检查 OSS 是否已配置
   */
  isConfigured(): boolean {
    return !!this.ossClient;
  }

  /**
   * 存储文件
   * @param buffer 文件缓冲区
   * @param filePath 存储路径
   * @returns 存储结果
   */
  async store(buffer: Buffer, filePath: string): Promise<StorageResult> {
    if (!this.ossClient) {
      throw new Error('OSS 未配置');
    }

    const result = await this.ossClient.put(filePath, buffer);
    this.logger.debug(`文件已存储到 OSS: ${filePath}`);

    return {
      storageName: path.basename(filePath),
      filePath,
      fileUrl: this.cdnUrl ? `${this.cdnUrl}/${filePath}` : result.url,
    };
  }

  /**
   * 获取文件
   * @param filePath 存储路径
   * @returns 文件流
   */
  async retrieve(filePath: string): Promise<NodeJS.ReadableStream> {
    if (!this.ossClient) {
      throw new Error('OSS 未配置');
    }

    try {
      const result = await this.ossClient.get(filePath);
      return result.stream;
    } catch (error) {
      throw new NotFoundException('文件不存在');
    }
  }

  /**
   * 删除文件
   * @param filePath 存储路径
   */
  async delete(filePath: string): Promise<void> {
    if (!this.ossClient) {
      throw new Error('OSS 未配置');
    }

    await this.ossClient.delete(filePath);
    this.logger.debug(`文件已从 OSS 删除: ${filePath}`);
  }

  /**
   * 检查文件是否存在
   * @param filePath 存储路径
   */
  async exists(filePath: string): Promise<boolean> {
    if (!this.ossClient) {
      return false;
    }

    try {
      await this.ossClient.head(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件URL
   * @param filePath 存储路径
   */
  async getUrl(filePath: string): Promise<string> {
    if (this.cdnUrl) {
      return `${this.cdnUrl}/${filePath}`;
    }
    const region = this.configService.get<string>('OSS_REGION', '');
    return `https://${this.bucket}.oss-${region}.aliyuncs.com/${filePath}`;
  }

  /**
   * 获取签名URL（临时访问）
   * @param filePath 存储路径
   * @param expires 过期时间（秒）
   */
  async getSignedUrl(filePath: string, expires: number = 3600): Promise<string> {
    if (!this.ossClient) {
      throw new Error('OSS 未配置');
    }
    return this.ossClient.signatureUrl(filePath, { expires });
  }
}
