/**
 * 数据库连接配置
 */
export interface DatabaseConnectionConfig {
  /** 主机地址 */
  host: string;
  /** 端口号 */
  port: number;
  /** 用户名 */
  user: string;
  /** 密码（支持 {{ENV:VAR_NAME}} 环境变量引用） */
  password: string;
  /** 数据库名称 */
  database: string;
  /** SSL 配置 */
  ssl?: boolean | { ca?: string; cert?: string; key?: string };
}

/**
 * SQL 校验结果
 */
export interface SqlValidationResult {
  /** 是否通过校验 */
  valid: boolean;
  /** 错误信息列表 */
  errors: string[];
  /** 警告信息列表 */
  warnings: string[];
}

/**
 * 连接池条目
 */
export interface PoolEntry {
  /** 数据库连接池实例 */
  pool: import('mysql2/promise').Pool;
  /** 创建时间 */
  createdAt: Date;
  /** 最近使用时间 */
  lastUsedAt: Date;
  /** 配置哈希，用于标识连接池 */
  configHash: string;
}