import { Injectable, Logger } from '@nestjs/common';
import { SqlValidationResult } from './dto/database-config.dto';

/**
 * SQL 安全校验器
 * 负责校验 SQL 语句的安全性，防止注入攻击和危险操作
 */
@Injectable()
export class SqlValidator {
  private readonly logger = new Logger(SqlValidator.name);

  /** 只读模式下允许的 SQL 前缀 */
  private readonly READ_ONLY_PREFIXES = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'WITH'];

  /** 危险操作关键字（非只读模式下的额外警告） */
  private readonly DANGEROUS_KEYWORDS = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE'];

  /**
   * 校验 SQL 语句
   * @param sql 原始 SQL 语句
   * @param readOnly 是否强制只读模式
   * @returns 校验结果
   */
  validate(sql: string, readOnly: boolean): SqlValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const trimmed = sql.trim();

    if (!trimmed) {
      errors.push('SQL 语句不能为空');
      return { valid: false, errors, warnings };
    }

    const statements = trimmed
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (statements.length > 1) {
      errors.push('不允许执行多条 SQL 语句');
    }

    if (readOnly) {
      const upperSql = trimmed.toUpperCase().trimStart();
      const isReadOnly = this.READ_ONLY_PREFIXES.some(
        (prefix) => upperSql.startsWith(prefix),
      );
      if (!isReadOnly) {
        errors.push(
          `只读模式下仅允许: ${this.READ_ONLY_PREFIXES.join(', ')}，当前语句被拒绝`,
        );
      }
    }

    for (const keyword of this.DANGEROUS_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(trimmed)) {
        if (readOnly) {
          errors.push(`只读模式下不允许危险操作: ${keyword}`);
        } else {
          warnings.push(`SQL 包含危险操作: ${keyword}`);
        }
      }
    }

    if (/\/\*|\*\/|--/.test(trimmed)) {
      warnings.push('SQL 包含注释标记，请确认是否存在注入风险');
    }

    if (/\bUNION\b/i.test(trimmed)) {
      if (readOnly) {
        warnings.push('SQL 包含 UNION 查询，请确认业务合理性');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 检测参数名是否匹配 SQL 中的占位符
   * @param sql SQL 模板
   * @param params 传入的参数
   * @returns 未使用的参数名列表和未绑定的占位符列表
   */
  checkParamBinding(
    sql: string,
    params: Record<string, unknown>,
  ): { unusedParams: string[]; unboundPlaceholders: string[] } {
    const placeholders = (sql.match(/:(\w+)/g) || []).map((p) => p.slice(1));
    const paramNames = Object.keys(params);

    const unusedParams = paramNames.filter((p) => !placeholders.includes(p));
    const unboundPlaceholders = placeholders.filter(
      (p) => !paramNames.includes(p),
    );

    return { unusedParams, unboundPlaceholders };
  }
}