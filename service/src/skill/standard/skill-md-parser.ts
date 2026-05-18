import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SkillFrontmatter, ParsedSkillFile, ValidationError } from './skill-md-validator';

/**
 * SKILL.md 解析器
 * 负责读取和解析 Agent Skills 标准格式的 SKILL.md 文件
 */
@Injectable()
export class SkillMdParser {
  private readonly logger = new Logger(SkillMdParser.name);
  private readonly frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

  /**
   * 从文件路径解析 SKILL.md
   */
  async parseFromFile(filePath: string): Promise<ParsedSkillFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parse(filePath, content);
  }

  /**
   * 从原始字符串内容解析
   */
  async parseFromString(content: string, skillDirPath: string = ''): Promise<ParsedSkillFile> {
    const simulatedPath = path.join(skillDirPath, 'SKILL.md');
    return this.parse(simulatedPath, content);
  }

  /**
   * 核心解析逻辑
   */
  private parse(filePath: string, content: string): ParsedSkillFile {
    const directoryPath = path.dirname(filePath);
    const match = content.match(this.frontmatterRegex);

    if (!match) {
      throw new SkillParseError(
        'SKILL.md 格式错误：未找到有效的 YAML frontmatter。Frontmatter 必须用 --- 包裹。',
        filePath,
      );
    }

    const rawYaml = match[1];
    const body = match[2].trim();

    let frontmatter: SkillFrontmatter;
    try {
      const parsed = yaml.load(rawYaml);
      if (!parsed || typeof parsed !== 'object') {
        throw new SkillParseError('SKILL.md frontmatter 为空或格式无效', filePath);
      }
      frontmatter = this.normalizeFrontmatter(parsed as Record<string, unknown>, directoryPath);
    } catch (err) {
      if (err instanceof SkillParseError) throw err;
      throw new SkillParseError(
        `SKILL.md YAML 解析失败: ${(err as Error).message}`,
        filePath,
      );
    }

    const bodyTokens = this.estimateTokens(body);
    if (bodyTokens > 5000) {
      this.logger.warn(
        `技能 "${frontmatter.name}" 正文约 ${bodyTokens} tokens，超过建议的 5000 token 硬限制`,
      );
    }

    return {
      frontmatter,
      body,
      bodyTokens,
      rawYaml,
      filePath,
      directoryPath,
    };
  }

  /**
   * 规范化 frontmatter 字段
   */
  private normalizeFrontmatter(
    raw: Record<string, unknown>,
    directoryPath: string,
  ): SkillFrontmatter {
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const description = typeof raw.description === 'string' ? raw.description.trim() : '';

    const directoryName = path.basename(directoryPath);
    if (name && directoryName && name !== directoryName) {
      this.logger.warn(
        `技能名称 "${name}" 与目录名 "${directoryName}" 不一致`,
      );
    }

    const metadata = raw.metadata && typeof raw.metadata === 'object'
      ? this.normalizeMetadata(raw.metadata as Record<string, unknown>)
      : undefined;

    return {
      name,
      description,
      license: typeof raw.license === 'string' ? raw.license.trim() : undefined,
      compatibility: typeof raw.compatibility === 'string' ? raw.compatibility.trim() : undefined,
      metadata,
      allowedTools: typeof raw['allowed-tools'] === 'string'
        ? raw['allowed-tools'].trim()
        : undefined,
      requires: this.normalizeRequires(raw.requires),
    };
  }

  /**
   * 规范化 requires 字段
   * @param requires 原始 requires 对象
   * @returns 规范化后的 SkillRequires 对象
   */
  private normalizeRequires(requires: unknown): SkillFrontmatter['requires'] {
    if (!requires || typeof requires !== 'object') {
      return undefined;
    }

    const raw = requires as Record<string, unknown>;
    const result: NonNullable<SkillFrontmatter['requires']> = {};

    const mcpServers = raw['mcp-servers'] || raw.mcpServers;
    if (Array.isArray(mcpServers)) {
      result.mcpServers = mcpServers
        .filter((v: unknown): v is string => typeof v === 'string')
        .map((v: string) => v.trim());
    }

    const knowledgeBases = raw['knowledge-bases'] || raw.knowledgeBases;
    if (Array.isArray(knowledgeBases)) {
      result.knowledgeBases = knowledgeBases
        .filter((v: unknown): v is string => typeof v === 'string')
        .map((v: string) => v.trim());
    }

    if (Array.isArray(raw.tools)) {
      result.tools = raw.tools
        .filter((v: unknown): v is string => typeof v === 'string')
        .map((v: string) => v.trim());
    }

    if (Array.isArray(raw.skills)) {
      result.skills = raw.skills
        .filter((v: unknown): v is string => typeof v === 'string')
        .map((v: string) => v.trim());
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * 规范化 metadata（确保所有值都是字符串）
   */
  private normalizeMetadata(meta: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(meta)) {
      result[key] = String(value);
    }
    return result;
  }

  /**
   * 粗略估算 Token 数量（英文约 4 字符 ≈ 1 token）
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 检查目录是否符合标准技能结构
   */
  async inspectDirectory(dirPath: string): Promise<{
    hasSkillMd: boolean;
    hasScripts: boolean;
    hasReferences: boolean;
    hasAssets: boolean;
    skillMdPath: string | null;
  }> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let hasSkillMd = false;
      let skillMdPath: string | null = null;
      let hasScripts = false;
      let hasReferences = false;
      let hasAssets = false;

      for (const entry of entries) {
        if (entry.name === 'SKILL.md' && entry.isFile()) {
          hasSkillMd = true;
          skillMdPath = path.join(dirPath, entry.name);
        }
        if (entry.name === 'scripts' && entry.isDirectory()) hasScripts = true;
        if (entry.name === 'references' && entry.isDirectory()) hasReferences = true;
        if (entry.name === 'assets' && entry.isDirectory()) hasAssets = true;
      }

      return { hasSkillMd, hasScripts, hasReferences, hasAssets, skillMdPath };
    } catch {
      return { hasSkillMd: false, hasScripts: false, hasReferences: false, hasAssets: false, skillMdPath: null };
    }
  }
}

/**
 * SKILL.md 解析错误
 */
export class SkillParseError extends Error {
  public readonly filePath: string;

  constructor(message: string, filePath: string) {
    super(message);
    this.name = 'SkillParseError';
    this.filePath = filePath;
  }
}
