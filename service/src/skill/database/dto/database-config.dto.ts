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
 * 数据库技能配置（对应 skill.config 字段的 JSON 结构）
 */
export interface DatabaseSkillConfig {
  /** 数据库类型 */
  databaseType: 'mysql' | 'postgresql';
  /** 是否强制只读 */
  readOnly: boolean;
  /** 最大返回行数 */
  maxRows: number;
  /** SQL 查询模板 */
  query: string;
  /** 数据库连接配置 */
  connection: DatabaseConnectionConfig;
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
 * 数据库查询结果
 */
export interface DatabaseQueryResult {
  /** 查询结果行 */
  rows: unknown[];
  /** 返回行数 */
  rowCount: number;
  /** 实际执行的 SQL（调试用，生产环境建议关闭） */
  executedSql?: string;
  /** 查询耗时（毫秒） */
  costMs: number;
}

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  /** 是否连接成功 */
  success: boolean;
  /** 数据库版本信息 */
  serverVersion?: string;
  /** 连接延迟（毫秒） */
  latencyMs?: number;
  /** 错误信息 */
  error?: string;
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