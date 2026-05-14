/**
 * 文件类型枚举
 */
export enum FileType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  PDF = 'pdf',
  DOC = 'doc',
  EXCEL = 'excel',
  TXT = 'txt',
  ZIP = 'zip',
  OTHER = 'other',
}

/**
 * 存储类型枚举
 */
export enum StorageType {
  LOCAL = 'local',
  OSS = 'oss',
  S3 = 's3',
  MINIO = 'minio',
}

/**
 * 业务类型枚举
 */
export enum BusinessType {
  KB = 'kb',
  AVATAR = 'avatar',
  AGENT = 'agent',
  WORKFLOW = 'workflow',
  TEMP = 'temp',
  EXPORT = 'export',
}

/**
 * 处理任务类型枚举
 */
export enum ProcessTaskType {
  COMPRESS = 'compress',
  CONVERT = 'convert',
  CROP = 'crop',
  WATERMARK = 'watermark',
  THUMBNAIL = 'thumbnail',
  RESIZE = 'resize',
  OCR = 'ocr',
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * 上传选项接口
 */
export interface UploadOptions {
  businessType?: string;
  businessId?: string;
  storageType?: string;
  isPublic?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  deniedExtensions?: string[];
  enableDedup?: boolean;
  processConfig?: ProcessConfig;
  appCode?: string;
  uid?: string;
}

/**
 * 处理配置接口
 */
export interface ProcessConfig {
  type: string;
  options: Record<string, any>;
}

/**
 * 上传结果接口
 */
export interface FileUploadResult {
  fileId: any;
  fileUrl: string;
  isDuplicate: boolean;
}

/**
 * 下载结果接口
 */
export interface FileDownloadResult {
  stream: NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * 查询参数接口
 */
export interface QueryFileDto {
  businessType?: string;
  fileType?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 列表结果接口
 */
export interface FileListResult {
  list: any[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 文件记录接口
 */
export interface FileRecord {
  id: string;
  fileName: string;
  storageName: string;
  filePath: string;
  fileUrl: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  fileHash?: string;
  storageType: string;
  businessType: string;
  businessId?: string;
  isPublic: boolean;
  accessCount: number;
  appCode?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
