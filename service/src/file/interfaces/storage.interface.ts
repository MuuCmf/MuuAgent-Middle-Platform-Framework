/**
 * 存储引擎接口
 */
export interface StorageEngine {
  /**
   * 存储文件
   * @param buffer 文件缓冲区
   * @param path 存储路径
   * @returns 存储结果
   */
  store(buffer: Buffer, path: string): Promise<StorageResult>;

  /**
   * 获取文件
   * @param path 存储路径
   * @returns 文件流
   */
  retrieve(path: string): Promise<NodeJS.ReadableStream>;

  /**
   * 删除文件
   * @param path 存储路径
   */
  delete(path: string): Promise<void>;

  /**
   * 检查文件是否存在
   * @param path 存储路径
   */
  exists(path: string): Promise<boolean>;

  /**
   * 获取文件URL
   * @param path 存储路径
   */
  getUrl(path: string): Promise<string>;
}

/**
 * 存储结果接口
 */
export interface StorageResult {
  storageName: string;
  filePath: string;
  fileUrl: string;
}
