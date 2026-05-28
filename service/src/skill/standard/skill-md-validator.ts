import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';

/**
 * 技能依赖配置
 */
export interface SkillRequires {
  mcpServers?: string[];
  knowledgeBases?: string[];
  tools?: string[];
  skills?: string[];
  /** 是否需要 workspace 文件操作能力 */
  workspace?: boolean;
  /** 是否需要桌面自动化操作能力（鼠标、键盘、截屏、命令执行等） */
  desktopAutomation?: boolean;
  /** 是否需要浏览器自动化操作能力（页面导航、截图、点击、填充表单等） */
  browser?: boolean;
}

/**
 * SKILL.md Frontmatter 字段定义
 * 对齐 Agent Skills Open Specification V1.0 (agentskills.io)
 *
 * 标准必填字段：name, description
 * 标准可选字段：version, license, compatibility, allowed-tools, metadata
 * 平台扩展字段：requires（MuuAgent 特有，声明依赖）
 */
export interface SkillFrontmatter {
  /** 技能唯一标识，小写字母+数字+连字符，最长64字符，须与目录名一致 */
  name: string;
  /** 语义版本号（标准可选） */
  version?: string;
  /** 技能描述及触发条件，最长1024字符 */
  description: string;
  /** 许可协议标识（如 MIT, Apache-2.0） */
  license?: string;
  /** 环境兼容性说明 */
  compatibility?: string;
  /** 平台扩展元数据（标准允许的自定义键值对） */
  metadata?: Record<string, string>;
  /** 预授权工具列表（逗号或空格分隔） */
  allowedTools?: string;
  /** 依赖声明（MuuAgent 扩展，标准不定义此字段） */
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
   * 对齐 Agent Skills Open Specification V1.0 校验规则
   */
  validate(parsed: ParsedSkillFile): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    this.validateName(parsed, errors);
    this.validateDescription(parsed, errors);
    this.validateVersion(parsed, warnings);
    this.validateLicense(parsed, warnings);
    this.validateCompatibility(parsed, errors);
    this.validateAllowedTools(parsed, warnings);
    this.validateBody(parsed, errors, warnings);
    this.validateDirectoryStructure(parsed, warnings);

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
   * 校验 version 字段（语义版本号格式）
   * @param parsed 解析后的技能文件
   * @param warnings 警告列表
   */
  private validateVersion(parsed: ParsedSkillFile, warnings: string[]): void {
    const { version } = parsed.frontmatter;
    if (!version) return;

    const semverPattern = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/;
    if (!semverPattern.test(version)) {
      warnings.push(`version "${version}" 不符合语义版本号规范（推荐格式：1.0.0）`);
    }
  }

  /**
   * 校验 allowed-tools 字段格式
   * @param parsed 解析后的技能文件
   * @param warnings 警告列表
   */
  private validateAllowedTools(parsed: ParsedSkillFile, warnings: string[]): void {
    const { allowedTools } = parsed.frontmatter;
    if (!allowedTools) return;

    const tools = allowedTools.split(/[\s,]+/).filter(Boolean);
    const toolPattern = /^[a-zA-Z0-9_-]+$/;

    for (const tool of tools) {
      if (!toolPattern.test(tool)) {
        warnings.push(`allowed-tools 中的 "${tool}" 包含非法字符，推荐仅使用字母、数字、连字符和下划线`);
      }
    }
  }

  /**
   * 校验目录结构是否符合 Agent Skills 标准
   * 标准目录结构：skill-name/SKILL.md + scripts/ + references/ + assets/
   * @param parsed 解析后的技能文件
   * @param warnings 警告列表
   */
  private validateDirectoryStructure(parsed: ParsedSkillFile, warnings: string[]): void {
    const dir = parsed.directoryPath;
    const dirName = dir.split(/[/\\]/).pop() || '';

    /** 检查目录名是否符合标准命名规范 */
    if (dirName && !this.namePattern.test(dirName)) {
      warnings.push(
        `目录名 "${dirName}" 不符合 Agent Skills 标准命名规范（小写字母+数字+连字符），跨平台共享时可能不被识别`,
      );
    }

    /** 检查是否缺少标准子目录（仅提示，不阻断） */
    const standardDirs = ['scripts', 'references', 'assets'];
    const fs = require('fs');
    for (const sub of standardDirs) {
      const subPath = path.join(dir, sub);
      if (!fs.existsSync(subPath)) {
        /** 仅当 SKILL.md 正文引用了该子目录时才警告 */
        if (parsed.body.includes(`${sub}/`)) {
          warnings.push(`正文引用了 ${sub}/ 目录但该目录不存在`);
        }
      }
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
