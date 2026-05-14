import { PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { generateId } from '../utils/snowflake.util';

/**
 * Prisma 服务
 * 扩展 PrismaClient，添加雪花ID生成中间件
 */
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * 构造函数
   */
  constructor() {
    super();
  }

  /**
   * 模块初始化时注册中间件
   */
  async onModuleInit() {
    await this.$connect();
    this.logger.log('数据库连接成功');
    this.registerSnowflakeIdMiddleware();
  }

  /**
   * 注册雪花ID生成中间件
   * 在创建记录时自动生成雪花ID
   * 应用层使用 string，数据库层使用 BigInt
   */
  private registerSnowflakeIdMiddleware(): void {
    // 写入中间件：生成 ID + string -> BigInt
    this.$use(async (params, next) => {
      try {
        // 处理创建操作
        if (params.action === 'create') {
          const data = params.args?.data;
          if (data) {
            // 检查 id 是否为空、0 或未定义
            if (!data.id || data.id === 0 || data.id === BigInt(0) || data.id === '') {
              const snowflakeId = generateId();
              data.id = BigInt(snowflakeId);
              this.logger.debug(`为 ${params.model} 生成雪花 ID: ${snowflakeId}`);
            }
            this.convertStringToBigInt(data);
          }
        } else if (params.action === 'createMany') {
          if (params.args?.data && Array.isArray(params.args.data)) {
            params.args.data.forEach((item: any) => {
              // 检查 id 是否为空、0 或未定义
              if (!item.id || item.id === 0 || item.id === BigInt(0) || item.id === '') {
                const snowflakeId = generateId();
                item.id = BigInt(snowflakeId);
                this.logger.debug(`为 ${params.model} 生成雪花 ID: ${snowflakeId}`);
              }
              this.convertStringToBigInt(item);
            });
          }
        } else if (params.action === 'upsert') {
          if (params.args?.update) {
            this.convertStringToBigInt(params.args.update);
          }
          if (params.args?.create) {
            const data = params.args.create;
            if (!data.id || data.id === 0 || data.id === BigInt(0) || data.id === '') {
              const snowflakeId = generateId();
              data.id = BigInt(snowflakeId);
              this.logger.debug(`为 ${params.model} (upsert create) 生成雪花 ID: ${snowflakeId}`);
            }
            this.convertStringToBigInt(data);
          }
        } else if (params.action === 'update') {
          if (params.args?.data) {
            this.convertStringToBigInt(params.args.data);
          }
        } else if (params.action === 'updateMany') {
          if (params.args?.data && Array.isArray(params.args.data)) {
            params.args.data.forEach((item: any) => this.convertStringToBigInt(item));
          }
        }
        
        // 处理 where 条件
        if (params.args?.where) {
          this.convertStringToBigInt(params.args.where);
        }

        const result = await next(params);
        
        // 读取中间件：BigInt -> string
        return this.convertBigIntToString(result);
      } catch (error) {
        this.logger.error(`中间件处理错误: ${error.message}`, error.stack);
        throw error;
      }
    });

    this.logger.log('雪花ID生成中间件已注册');
  }

  /**
   * 递归转换对象中的 string ID 为 BigInt
   * @param obj 要转换的对象
   */
  private convertStringToBigInt(obj: any): void {
    if (!obj || typeof obj !== 'object') return;

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        
        // 处理 ID 字段（包括外键），但排除 targetId（它是字符串标识符）
        if ((key === 'id' || key.endsWith('Id')) && key !== 'targetId' && key !== 'conversationId' && key !== 'requestId' && typeof value === 'string' && value !== '' && /^\d+$/.test(value)) {
          try {
            obj[key] = BigInt(value);
          } catch (e) {
            this.logger.warn(`无法将 ${key}=${value} 转换为 BigInt`);
          }
        }
        // 处理嵌套对象（排除数组）
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          this.convertStringToBigInt(value);
        }
      }
    }
  }

  /**
   * 递归转换 BigInt 为 string
   * @param obj 要转换的对象
   * @returns 转换后的对象
   */
  private convertBigIntToString(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // 处理 BigInt 类型
    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    // 处理 Date 类型（保持原样）
    if (obj instanceof Date) {
      return obj;
    }

    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertBigIntToString(item));
    }

    // 处理对象
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // 处理 ID 字段（包括外键），但排除 targetId（它是字符串标识符）
          if ((key === 'id' || key.endsWith('Id')) && key !== 'targetId') {
            if (typeof value === 'bigint') {
              converted[key] = value.toString();
            } else {
              converted[key] = value;
            }
          } else {
            converted[key] = this.convertBigIntToString(value);
          }
        }
      }
      return converted;
    }

    return obj;
  }
}
