import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageEngine, StorageResult } from '../interfaces/storage.interface';
import { LocalStorage } from './local.storage';
import { OssStorage } from './oss.storage';

/**
 * 存储服务
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageEngines: Map<string, StorageEngine> = new Map();
  private readonly defaultStorageType: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly localStorage: LocalStorage,
    private readonly ossStorage: OssStorage,
  ) {
    this.storageEngines.set('local', localStorage);
    this.storageEngines.set('oss', ossStorage);
    this.defaultStorageType = this.configService.get<string>('FILE_DEFAULT_STORAGE', 'local');
  }

  /**
   * 存储文件
   * @param buffer 文件缓冲区
   * @param path 存储路径
   * @param storageType 存储类型
   * @returns 存储结果
   */
  async store(
    buffer: Buffer,
    path: string,
    storageType?: string,
  ): Promise<StorageResult> {
    const type = storageType || this.defaultStorageType;
    const engine = this.getEngine(type);
    this.logger.debug(`存储文件到 ${type}: ${path}`);
    return engine.store(buffer, path);
  }

  /**
   * 获取文件
   * @param path 存储路径
   * @param storageType 存储类型
   * @returns 文件流
   */
  async retrieve(path: string, storageType?: string): Promise<NodeJS.ReadableStream> {
    const type = storageType || this.defaultStorageType;
    const engine = this.getEngine(type);
    return engine.retrieve(path);
  }

  /**
   * 删除文件
   * @param path 存储路径
   * @param storageType 存储类型
   */
  async delete(path: string, storageType?: string): Promise<void> {
    const type = storageType || this.defaultStorageType;
    const engine = this.getEngine(type);
    this.logger.debug(`删除文件: ${path}`);
    return engine.delete(path);
  }

  /**
   * 检查文件是否存在
   * @param path 存储路径
   * @param storageType 存储类型
   */
  async exists(path: string, storageType?: string): Promise<boolean> {
    const type = storageType || this.defaultStorageType;
    const engine = this.getEngine(type);
    return engine.exists(path);
  }

  /**
   * 获取文件URL
   * @param path 存储路径
   * @param storageType 存储类型
   */
  async getUrl(path: string, storageType?: string): Promise<string> {
    const type = storageType || this.defaultStorageType;
    const engine = this.getEngine(type);
    return engine.getUrl(path);
  }

  /**
   * 获取存储引擎
   * @param type 存储类型
   * @returns 存储引擎
   */
  private getEngine(type: string): StorageEngine {
    const engine = this.storageEngines.get(type);
    if (!engine) {
      throw new Error(`不支持的存储类型: ${type}`);
    }
    return engine;
  }
}
