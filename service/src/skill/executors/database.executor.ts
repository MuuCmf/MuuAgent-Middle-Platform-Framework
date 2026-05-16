import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { ConnectionPoolManager } from '../database/connection-pool.manager';
import { SqlValidator } from '../database/sql-validator';
import {
  DatabaseSkillConfig,
  DatabaseQueryResult,
  ConnectionTestResult,
} from '../database/dto/database-config.dto';

/**
 * 数据库技能执行器
 * 负责解析技能配置、校验 SQL、执行参数化查询并返回格式化结果
 *
 * 核心流程：
 *   parseConfig → validate → convertNamedParams → appendLimit → pool.query
 */
@Injectable()
export class DatabaseExecutor {
  private readonly logger = new Logger(DatabaseExecutor.name);

  /**
   * 构造函数
   * @param poolManager 连接池管理器
   * @param sqlValidator SQL 安全校验器
   */
  constructor(
    private readonly poolManager: ConnectionPoolManager,
    private readonly sqlValidator: SqlValidator,
  ) {}

  /**
   * 执行数据库查询
   * @param skill 技能记录（含 config 和 timeout）
   * @param params 用户传入的命名参数
   * @returns 查询结果
   */
  async execute(
    skill: { config: string; timeout: number },
    params: Record<string, unknown>,
  ): Promise<DatabaseQueryResult> {
    const startTime = Date.now();

    const config = this.parseConfig(skill.config);
    this.validateConfig(config);

    const {
      query,
      connection,
      databaseType = 'mysql',
      readOnly = true,
      maxRows = 1000,
    } = config;

    const validation = this.sqlValidator.validate(query, readOnly);
    if (!validation.valid) {
      this.logger.warn(`SQL 校验失败: ${validation.errors.join('; ')}`);
      throw new HttpException(
        { message: 'SQL 校验失败', errors: validation.errors, warnings: validation.warnings },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (validation.warnings.length > 0) {
      this.logger.warn(`SQL 校验警告: ${validation.warnings.join('; ')}`);
    }

    const { unboundPlaceholders, unusedParams } = this.sqlValidator.checkParamBinding(
      query,
      params,
    );
    if (unboundPlaceholders.length > 0) {
      throw new HttpException(
        `缺少参数: ${unboundPlaceholders.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (unusedParams.length > 0) {
      this.logger.warn(`存在未使用的参数: ${unusedParams.join(', ')}`);
    }

    const { sql: parameterizedSql, values } = this.convertNamedParams(query, params);

    const finalSql = this.appendLimit(parameterizedSql, maxRows);

    const pool = this.poolManager.getPool(databaseType, connection);

    try {
      const [rows] = await this.queryWithTimeout(pool, finalSql, values, skill.timeout);
      const rowArray = rows as unknown[];
      const costMs = Date.now() - startTime;

      this.logger.log(
        `数据库查询成功: ${rowArray.length} 行, 耗时 ${costMs}ms`,
      );

      return {
        rows: rowArray,
        rowCount: rowArray.length,
        executedSql: finalSql,
        costMs,
      };
    } catch (error: any) {
      const costMs = Date.now() - startTime;
      this.logger.error(`数据库查询失败 [${costMs}ms]: ${error.message}`);

      throw new HttpException(
        {
          message: '数据库查询失败',
          detail: error.message,
          costMs,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 测试数据库连接
   * @param configStr 技能配置 JSON 字符串
   * @returns 连接测试结果
   */
  async testConnection(configStr: string): Promise<ConnectionTestResult> {
    const config = this.parseConfig(configStr);
    const { connection, databaseType = 'mysql' } = config;

    return await this.poolManager.testConnection(databaseType, connection);
  }

  /**
   * 解析技能配置 JSON，并处理环境变量引用
   * @param configStr 配置 JSON 字符串
   * @returns 解析后的配置对象
   */
  private parseConfig(configStr: string): DatabaseSkillConfig {
    try {
      const config = JSON.parse(configStr);
      if (config.connection?.password) {
        config.connection.password = this.resolveEnvVars(config.connection.password);
      }
      return config;
    } catch (error: any) {
      throw new HttpException(
        `技能配置 JSON 格式错误: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 校验配置完整性
   * @param config 数据库技能配置
   */
  private validateConfig(config: DatabaseSkillConfig): void {
    const errors: string[] = [];

    if (!config.query || typeof config.query !== 'string') {
      errors.push('SQL 查询语句不能为空');
    }

    if (!config.connection) {
      errors.push('数据库连接配置不能为空');
    } else {
      const requiredFields: (keyof typeof config.connection)[] = [
        'host',
        'port',
        'user',
        'password',
        'database',
      ];
      for (const field of requiredFields) {
        if (!config.connection[field]) {
          errors.push(`连接配置缺少必填字段: ${field}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new HttpException(
        { message: '配置校验失败', errors },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 命名参数 :paramName → ? 占位符 + 值数组
   * 例如: "SELECT * FROM t WHERE a = :a AND b = :b" + {a: 1, b: 2}
   *     → "SELECT * FROM t WHERE a = ? AND b = ?" + [1, 2]
   *
   * @param sql 含 :paramName 的 SQL 模板
   * @param params 参数键值对
   * @returns 转换后的 SQL 和值数组
   */
  private convertNamedParams(
    sql: string,
    params: Record<string, unknown>,
  ): { sql: string; values: unknown[] } {
    const values: unknown[] = [];
    const converted = sql.replace(/:(\w+)/g, (_match, paramName) => {
      if (!(paramName in params)) {
        throw new HttpException(
          `缺少参数: ${paramName}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      values.push(params[paramName]);
      return '?';
    });
    return { sql: converted, values };
  }

  /**
   * 自动追加 LIMIT 子句（如果 SQL 中未指定）
   * @param sql SQL 语句
   * @param maxRows 最大行数
   * @returns 追加 LIMIT 后的 SQL
   */
  private appendLimit(sql: string, maxRows: number): string {
    const trimmed = sql.trim().replace(/;+\s*$/, '');
    if (!/\bLIMIT\s+\d+/i.test(trimmed)) {
      return `${trimmed} LIMIT ${maxRows}`;
    }
    return trimmed;
  }

  /**
   * 带超时控制的查询
   * @param pool 连接池
   * @param sql SQL 语句
   * @param values 参数值数组
   * @param timeoutMs 超时时间（毫秒）
   * @returns 查询结果
   */
  private async queryWithTimeout(
    pool: mysql.Pool,
    sql: string,
    values: unknown[],
    timeoutMs: number,
  ): Promise<[mysql.QueryResult, mysql.FieldPacket[]]> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`数据库查询超时 (${timeoutMs}ms)`));
      }, timeoutMs);
    });

    const queryPromise = pool.query(sql, values);

    return Promise.race([queryPromise, timeoutPromise]) as Promise<[mysql.QueryResult, mysql.FieldPacket[]]>;
  }

  /**
   * 解析环境变量引用 {{ENV:VAR_NAME}}
   * @param value 包含环境变量引用的字符串
   * @returns 解析后的字符串
   */
  private resolveEnvVars(value: string): string {
    return value.replace(/\{\{ENV:(\w+)\}\}/g, (_match, varName) => {
      const envValue = process.env[varName];
      if (!envValue) {
        this.logger.warn(`环境变量 ${varName} 未设置`);
      }
      return envValue || '';
    });
  }
}