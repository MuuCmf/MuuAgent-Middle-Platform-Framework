import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as mysql from 'mysql2/promise';
import { ConnectionPoolManager } from '../../skill/database/connection-pool.manager';
import { SqlValidator } from '../../skill/database/sql-validator';
import { FunctionToolDefinition } from './tool-definitions';

/**
 * 数据库查询结果
 */
export interface DbQueryResult {
  rows: unknown[];
  row_count: number;
  sql: string;
  duration: number;
}

/**
 * 通用数据库查询工具
 *
 * 取代所有 DATABASE 类型的 DB 技能。仅允许只读查询（SELECT）。
 * 复用 DatabaseExecutor 的 SQL 校验和参数化查询能力。
 */
@Injectable()
export class DbQueryTool {
  private readonly logger = new Logger(DbQueryTool.name);

  constructor(
    private readonly poolManager: ConnectionPoolManager,
    private readonly sqlValidator: SqlValidator,
  ) {}

  static readonly definition: FunctionToolDefinition = {
    type: 'function',
    function: {
      name: 'db_query',
      description: `执行只读数据库查询（仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN）。
支持 MySQL 命名参数（:paramName 格式）。使用前请确保已通过 use_skill 加载相关技能指令，
了解数据库连接信息和表结构。连接密码支持 {{ENV:VAR}} 环境变量引用。`,
      parameters: {
        type: 'object',
        properties: {
          host: {
            type: 'string',
            description: '数据库主机地址',
          },
          port: {
            type: 'number',
            description: '数据库端口，默认 3306',
          },
          user: {
            type: 'string',
            description: '数据库用户名',
          },
          password: {
            type: 'string',
            description: '数据库密码。支持 {{ENV:VAR_NAME}} 引用环境变量',
          },
          database: {
            type: 'string',
            description: '数据库名称',
          },
          sql: {
            type: 'string',
            description: 'SQL 查询语句（仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN）。使用 :paramName 引用参数',
          },
          params: {
            type: 'object',
            description: 'SQL 参数键值对，键名对应 SQL 中的 :paramName',
          },
          max_rows: {
            type: 'number',
            description: '最大返回行数，默认 100，上限 1000',
          },
          timeout: {
            type: 'number',
            description: '超时（毫秒），默认 10000',
          },
        },
        required: ['host', 'user', 'password', 'database', 'sql'],
      },
    },
  };

  async execute(args: {
    host: string;
    port?: number;
    user: string;
    password: string;
    database: string;
    sql: string;
    params?: Record<string, unknown>;
    max_rows?: number;
    timeout?: number;
  }): Promise<DbQueryResult> {
    const startTime = Date.now();

    // SQL 安全校验（仅允许只读）
    const validation = this.sqlValidator.validate(args.sql, true);
    if (!validation.valid) {
      throw new HttpException(
        { message: 'SQL 校验失败', errors: validation.errors, warnings: validation.warnings },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (validation.warnings.length > 0) {
      this.logger.warn(`SQL 校验警告: ${validation.warnings.join('; ')}`);
    }

    const resolvedPassword = this.resolveEnvVars(args.password);
    const maxRows = Math.min(args.max_rows || 100, 1000);

    const pool = this.poolManager.getPool('mysql', {
      host: args.host,
      port: args.port || 3306,
      user: args.user,
      password: resolvedPassword,
      database: args.database,
    });

    // 命名参数转换 :paramName → ?
    const { sql: parameterizedSql, values } = this.convertNamedParams(args.sql, args.params || {});

    // 追加 LIMIT
    const finalSql = parameterizedSql.toUpperCase().includes('LIMIT')
      ? parameterizedSql
      : `${parameterizedSql.trim().replace(/;+\s*$/, '')} LIMIT ${maxRows}`;

    try {
      const [rows] = await this.queryWithTimeout(
        pool,
        finalSql,
        values,
        args.timeout || 10000,
      );
      const rowArray = rows as unknown[];
      const costMs = Date.now() - startTime;

      this.logger.log(`数据库查询成功: ${rowArray.length} 行, 耗时 ${costMs}ms`);

      return {
        rows: rowArray,
        row_count: rowArray.length,
        sql: finalSql,
        duration: costMs,
      };
    } catch (error: any) {
      const costMs = Date.now() - startTime;
      this.logger.error(`数据库查询失败 [${costMs}ms]: ${error.message}`);
      throw new HttpException(
        { message: '数据库查询失败', detail: error.message, costMs },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
