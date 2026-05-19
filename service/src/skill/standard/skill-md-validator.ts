import { Injectable, Logger } from '@nestjs/common';

/**
 * 技能依赖配置
 */
export interface SkillRequires {
  mcpServers?: string[];
  knowledgeBases?: string[];
  tools?: string[];
  skills?: string[];
}

/**
 * SKILL.md Frontmatter 字段定义
 */
export interface SkillFrontmatter {
  name: string;
  version?: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string;
  requires?: SkillRequires;
}

/**
 * 解析后的技能文件
 */
export interface ParsedSkillFile {
  frontmatter: SkillFrontmatter;
  body: string;
  bodyTokens: number;
  rawYaml: string;
  filePath: string;
  directoryPath: string;
}

/**
 * 校验错误
 */
export interface ValidationError {
  field: string;
  message: string;
  code: 'MISSING_REQUIRED' | 'FORMAT_INVALID' | 'LENGTH_EXCEEDED' | 'NAME_MISMATCH' | 'BODY_LIMIT_EXCEEDED';
}

/**
 * 校验结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * SKILL.md Frontmatter 校验器
 * 依据 Agent Skills Specification V1.0
 */
@Injectable()
export class SkillMdValidator {
  private readonly logger = new Logger(SkillMdValidator.name);

  private readonly namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  private readonly maxNameLength = 64;
  private readonly maxDescriptionLength = 1024;
  private readonly maxCompatibilityLength = 500;
  private readonly hardBodyTokenLimit = 5000;
  private readonly softBodyLineLimit = 500;

  /**
   * 校验解析后的技能文件
   */
  validate(parsed: ParsedSkillFile): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    this.validateName(parsed, errors);
    this.validateDescription(parsed, errors);
    this.validateLicense(parsed, warnings);
    this.validateCompatibility(parsed, errors);
    this.validateBody(parsed, errors, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 仅校验 frontmatter name 字段
   */
  private validateName(parsed: ParsedSkillFile, errors: ValidationError[]): void {
    const { name } = parsed.frontmatter;
    const directoryName = parsed.directoryPath.split(/[/\\]/).pop() || '';

    if (!name) {
      errors.push({
        field: 'name',
        message: 'name 字段为必填项',
        code: 'MISSING_REQUIRED',
      });
      return;
    }

    if (name.length > this.maxNameLength) {
      errors.push({
        field: 'name',
        message: `name 长度不能超过 ${this.maxNameLength} 个字符（当前 ${name.length} 字符）`,
        code: 'LENGTH_EXCEEDED',
      });
    }

    if (!this.namePattern.test(name)) {
      errors.push({
        field: 'name',
        message: 'name 只能包含小写字母、数字和连字符（不能以连字符开头/结尾，不能有连续连字符）',
        code: 'FORMAT_INVALID',
      });
    }

    if (directoryName && name !== directoryName) {
      errors.push({
        field: 'name',
        message: `name "${name}" 与目录名 "${directoryName}" 不一致`,
        code: 'NAME_MISMATCH',
      });
    }
  }

  /**
   * 校验 description 字段
   */
  private validateDescription(parsed: ParsedSkillFile, errors: ValidationError[]): void {
    const { description } = parsed.frontmatter;

    if (!description) {
      errors.push({
        field: 'description',
        message: 'description 字段为必填项',
        code: 'MISSING_REQUIRED',
      });
      return;
    }

    if (description.length > this.maxDescriptionLength) {
      errors.push({
        field: 'description',
        message: `description 长度不能超过 ${this.maxDescriptionLength} 个字符（当前 ${description.length} 字符）`,
        code: 'LENGTH_EXCEEDED',
      });
    }
  }

  /**
   * 校验 license（仅警告）
   */
  private validateLicense(parsed: ParsedSkillFile, warnings: string[]): void {
    if (!parsed.frontmatter.license) {
      warnings.push('建议填写 license 字段，明确技能的许可协议');
    }
  }

  /**
   * 校验 compatibility 字段
   */
  private validateCompatibility(parsed: ParsedSkillFile, errors: ValidationError[]): void {
    const { compatibility } = parsed.frontmatter;

    if (compatibility && compatibility.length > this.maxCompatibilityLength) {
      errors.push({
        field: 'compatibility',
        message: `compatibility 长度不能超过 ${this.maxCompatibilityLength} 个字符（当前 ${compatibility.length} 字符）`,
        code: 'LENGTH_EXCEEDED',
      });
    }
  }

  /**
   * 校验正文
   */
  private validateBody(
    parsed: ParsedSkillFile,
    errors: ValidationError[],
    warnings: string[],
  ): void {
    if (!parsed.body) {
      warnings.push('SKILL.md 正文为空，技能没有提供指令内容');
      return;
    }

    if (parsed.bodyTokens > this.hardBodyTokenLimit) {
      errors.push({
        field: 'body',
        message: `正文约 ${parsed.bodyTokens} tokens，超过硬限制 ${this.hardBodyTokenLimit} tokens。请将详细内容移到 references/ 目录`,
        code: 'BODY_LIMIT_EXCEEDED',
      });
    }

    const lineCount = parsed.body.split('\n').length;
    if (lineCount > this.softBodyLineLimit) {
      warnings.push(
        `正文 ${lineCount} 行，超过建议的 ${this.softBodyLineLimit} 行软限制。请将详细内容移到 references/ 目录`,
      );
    }
  }

  /**
   * 批量校验
   */
  validateBatch(parsedList: ParsedSkillFile[]): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();
    for (const parsed of parsedList) {
      results.set(parsed.frontmatter.name || parsed.filePath, this.validate(parsed));
    }
    return results;
  }
}
