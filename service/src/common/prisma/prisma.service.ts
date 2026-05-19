import { Prisma, PrismaClient } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { generateId } from '../utils/snowflake.util';

/** Prisma 写入操作键名集合 */
const PRISMA_MUTATION_KEYS = new Set([
  'create', 'connect', 'update', 'upsert', 'set',
  'disconnect', 'delete', 'connectOrCreate', 'createMany',
]);

/** Prisma 条件组合键名集合 */
const PRISMA_CONDITION_KEYS = new Set(['AND', 'OR', 'NOT']);

/** Prisma 关系过滤键名集合 */
const PRISMA_RELATION_FILTER_KEYS = new Set([
  'is', 'isNot', 'some', 'every', 'none',
]);

/**
 * Prisma 服务
 * 扩展 PrismaClient，添加雪花ID生成中间件
 * 基于 DMMF 元数据自动识别 BigInt 字段，无需手动维护排除列表
 */
export class PrismaService extends PrismaClient {
  private readonly logger = new Logger(PrismaService.name);

  /** BigInt 字段映射：modelName -> Set<fieldName> */
  private readonly bigIntFieldsMap: Map<string, Set<string>>;

  /** 关系映射：modelName -> (fieldName -> targetModelName) */
  private readonly relationMap: Map<string, Map<string, string>>;

  /**
   * 构造函数
   * 初始化 DMMF 元数据映射
   */
  constructor() {
    super();
    this.bigIntFieldsMap = this.buildBigIntFieldsMap();
    this.relationMap = this.buildRelationMap();
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
   * 从 Prisma DMMF 构建 BigInt 字段映射
   * 自动识别所有模型中的 BigInt 类型字段，无需手动维护排除列表
   * @returns 模型名到 BigInt 字段集合的映射
   */
  private buildBigIntFieldsMap(): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const model of Prisma.dmmf.datamodel.models) {
      const bigIntFields = new Set<string>();
      for (const field of model.fields) {
        if (field.type === 'BigInt') {
          bigIntFields.add(field.name);
        }
      }
      if (bigIntFields.size > 0) {
        map.set(model.name, bigIntFields);
      }
    }
    return map;
  }

  /**
   * 从 Prisma DMMF 构建关系映射
   * 用于在递归转换时追踪嵌套对象的目标模型
   * @returns 模型名到关系字段映射的映射
   */
  private buildRelationMap(): Map<string, Map<string, string>> {
    const map = new Map<string, Map<string, string>>();
    for (const model of Prisma.dmmf.datamodel.models) {
      const relations = new Map<string, string>();
      for (const field of model.fields) {
        if (field.kind === 'object' && field.relationName) {
          relations.set(field.name, field.type);
        }
      }
      if (relations.size > 0) {
        map.set(model.name, relations);
      }
    }
    return map;
  }

  /**
   * 检查字段在指定模型中是否为 BigInt 类型
   * @param modelName 模型名称
   * @param fieldName 字段名称
   * @returns 是否为 BigInt 字段
   */
  private isBigIntField(modelName: string | undefined, fieldName: string): boolean {
    if (!modelName) return false;
    return this.bigIntFieldsMap.get(modelName)?.has(fieldName) ?? false;
  }

  /**
   * 解析嵌套对象的模型名称
   * 处理关系字段和 Prisma 操作键名的模型推导
   * @param currentModel 当前模型名称
   * @param key 字段键名
   * @returns 嵌套对象的模型名称
   */
  private resolveNestedModel(currentModel: string | undefined, key: string): string | undefined {
    if (!currentModel) return undefined;

    const relationTarget = this.relationMap.get(currentModel)?.get(key);
    if (relationTarget) return relationTarget;

    if (PRISMA_MUTATION_KEYS.has(key)) return currentModel;
    if (PRISMA_CONDITION_KEYS.has(key)) return currentModel;
    if (PRISMA_RELATION_FILTER_KEYS.has(key)) return currentModel;

    return undefined;
  }

  /**
   * 注册雪花ID生成中间件
   * 在创建记录时自动生成雪花ID
   * 应用层使用 string，数据库层使用 BigInt
   */
  private registerSnowflakeIdMiddleware(): void {
    this.$use(async (params, next) => {
      try {
        const model = params.model;

        if (params.action === 'create') {
          const data = params.args?.data;
          if (data) {
            if (!data.id || data.id === 0 || data.id === BigInt(0) || data.id === '') {
              const snowflakeId = generateId();
              data.id = BigInt(snowflakeId);
              //this.logger.debug(`为 ${model} 生成雪花 ID: ${snowflakeId}`);
            }
            this.convertStringToBigInt(data, model);
          }
        } else if (params.action === 'createMany') {
          if (params.args?.data && Array.isArray(params.args.data)) {
            params.args.data.forEach((item: any) => {
              if (!item.id || item.id === 0 || item.id === BigInt(0) || item.id === '') {
                const snowflakeId = generateId();
                item.id = BigInt(snowflakeId);
                //this.logger.debug(`为 ${model} 生成雪花 ID: ${snowflakeId}`);
              }
              this.convertStringToBigInt(item, model);
            });
          }
        } else if (params.action === 'upsert') {
          if (params.args?.update) {
            this.convertStringToBigInt(params.args.update, model);
          }
          if (params.args?.create) {
            const data = params.args.create;
            if (!data.id || data.id === 0 || data.id === BigInt(0) || data.id === '') {
              const snowflakeId = generateId();
              data.id = BigInt(snowflakeId);
              //this.logger.debug(`为 ${model} (upsert create) 生成雪花 ID: ${snowflakeId}`);
            }
            this.convertStringToBigInt(data, model);
          }
        } else if (params.action === 'update') {
          if (params.args?.data) {
            this.convertStringToBigInt(params.args.data, model);
          }
        } else if (params.action === 'updateMany') {
          if (params.args?.data && Array.isArray(params.args.data)) {
            params.args.data.forEach((item: any) => this.convertStringToBigInt(item, model));
          }
        }

        if (params.args?.where) {
          this.convertStringToBigInt(params.args.where, model);
        }

        if (params.args?.cursor) {
          this.convertStringToBigInt(params.args.cursor, model);
        }

        const result = await next(params);

        return this.convertBigIntToString(result, model);
      } catch (error) {
        this.logger.error(`中间件处理错误: ${error.message}`, error.stack);
        throw error;
      }
    });

    this.logger.log('雪花ID生成中间件已注册');
  }

  /**
   * 递归转换对象中的 string 为 BigInt
   * 基于 Prisma DMMF 元数据自动识别 BigInt 字段，无需手动维护排除列表
   * @param obj 要转换的对象
   * @param modelName 当前对象所属的 Prisma 模型名称
   */
  private convertStringToBigInt(obj: any, modelName?: string): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach((item: any) => this.convertStringToBigInt(item, modelName));
      return;
    }

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      const value = obj[key];

      if (
        typeof value === 'string' &&
        value !== '' &&
        /^\d+$/.test(value) &&
        this.isBigIntField(modelName, key)
      ) {
        try {
          obj[key] = BigInt(value);
        } catch (e) {
          this.logger.warn(`无法将 ${key}=${value} 转换为 BigInt`);
        }
      } else if (typeof value === 'object' && value !== null) {
        const nestedModel = this.resolveNestedModel(modelName, key);
        this.convertStringToBigInt(value, nestedModel);
      }
    }
  }

  /**
   * 递归转换 BigInt 为 string
   * 基于 Prisma DMMF 元数据自动识别 BigInt 字段，无需手动维护排除列表
   * @param obj 要转换的对象
   * @param modelName 当前对象所属的 Prisma 模型名称
   * @returns 转换后的对象
   */
  private convertBigIntToString(obj: any, modelName?: string): any {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'bigint') return obj.toString();

    if (obj instanceof Date) return obj;

    if (Array.isArray(obj)) {
      return obj.map((item: any) => this.convertBigIntToString(item, modelName));
    }

    if (typeof obj === 'object') {
      const converted: any = {};
      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;

        const value = obj[key];
        const nestedModel = this.resolveNestedModel(modelName, key);

        if (this.isBigIntField(modelName, key)) {
          converted[key] = typeof value === 'bigint' ? value.toString() : value;
        } else {
          converted[key] = this.convertBigIntToString(value, nestedModel);
        }
      }
      return converted;
    }

    return obj;
  }
}
