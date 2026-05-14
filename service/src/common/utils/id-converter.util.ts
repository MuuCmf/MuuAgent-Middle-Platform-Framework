/**
 * ID 类型转换工具
 * 用于处理应用层 string 和数据库层 BigInt 之间的转换
 */
export class IdConverter {
  /**
   * 将 string ID 转换为 Prisma 接受的类型
   * 用于 where 条件和 data 中的 ID 字段
   * @param id string 类型的 ID
   * @returns 适合 Prisma 使用的类型（运行时由中间件处理）
   */
  static toPrisma(id: string | undefined | null): any {
    return id as any;
  }

  /**
   * 将 Prisma 返回的 ID 转换为 string
   * 用于处理查询结果中的 ID 字段
   * @param id Prisma 返回的 ID（可能是 bigint 或 string）
   * @returns string 类型的 ID
   */
  static fromPrisma(id: bigint | string | undefined | null): string | undefined {
    if (id === undefined || id === null) {
      return undefined;
    }
    return id.toString();
  }

  /**
   * 批量转换 ID 数组
   * @param ids ID 数组
   * @returns Prisma 接受的类型
   */
  static toPrismaArray(ids: string[]): any {
    return ids as any;
  }

  /**
   * 批量转换 Prisma 返回的 ID 数组
   * @param ids Prisma 返回的 ID 数组
   * @returns string 类型的 ID 数组
   */
  static fromPrismaArray(ids: (bigint | string)[]): string[] {
    return ids.map(id => id.toString());
  }
}
