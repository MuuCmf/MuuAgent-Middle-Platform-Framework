import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillMdParser } from './standard/skill-md-parser';
import { SkillMdValidator, ValidationError } from './standard/skill-md-validator';
import { IsolationContext } from '../common/utils/isolation.util';
import { PrismaService } from '../common/prisma/prisma.service';
import * as path from 'path';

/**
 * 导入模式
 */
export type ImportMode = 'database' | 'filesystem';

/**
 * 导入选项
 */
export interface ImportOptions {
  mode: ImportMode;
  appCode?: string;
  isPublic?: boolean;
  overwrite?: boolean;
  targetDir?: string;
}

/**
 * 安全扫描结果
 */
export interface SecurityScanResult {
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: SecurityIssue[];
  summary: string;
  passed: boolean;
}

export interface SecurityIssue {
  level: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  file: string;
  detail: string;
  line?: number;
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean;
  skillName: string;
  mode: ImportMode;
  securityScan: SecurityScanResult;
  validationErrors: ValidationError[];
  warnings: string[];
}

/**
 * 解压后的文件
 */
interface ExtractedFile {
  relativePath: string;
  content: string;
  isDirectory: boolean;
}

/**
 * 技能导入器
 * 负责导入 Agent Skills 标准格式的技能
 */
@Injectable()
export class SkillImporter {
  private readonly logger = new Logger(SkillImporter.name);

  private readonly allowedExtensions = new Set([
    '.md', '.py', '.sh', '.js', '.json', '.yaml', '.yml',
    '.txt', '.csv', '.xml', '.toml', '.cfg', '.ini', '.env.example',
  ]);

  private readonly blockedScriptPatterns = [
    { pattern: /eval\s*\(/, type: '危险代码执行', level: 'critical' as const },
    { pattern: /exec\s*\(/, type: '危险代码执行', level: 'critical' as const },
    { pattern: /child_process/, type: '危险模块引用', level: 'critical' as const },
    { pattern: /rm\s+-rf/, type: '危险文件操作', level: 'critical' as const },
    { pattern: />\s*\/dev\//, type: '危险文件操作', level: 'high' as const },
    { pattern: /curl\s+.*\|\s*(ba)?sh/, type: '疑似远程代码执行', level: 'critical' as const },
    { pattern: /wget\s+.*-O\s*-\s*\|/, type: '疑似远程代码执行', level: 'critical' as const },
    { pattern: /os\.system/, type: '危险系统调用', level: 'high' as const },
    { pattern: /subprocess\.(call|run|Popen)/, type: '危险系统调用', level: 'high' as const },
    { pattern: /__import__/, type: '危险导入', level: 'medium' as const },
    { pattern: /pip\s+install/, type: '依赖安装', level: 'medium' as const },
    { pattern: /npm\s+install/, type: '依赖安装', level: 'medium' as const },
    { pattern: /os\.environ/, type: '环境变量读取', level: 'low' as const },
    { pattern: /process\.env/, type: '环境变量读取', level: 'medium' as const },
    { pattern: /(?:password|secret|token|api_key)\s*=\s*['"][^'"]+['"]/,
      type: '疑似硬编码凭证', level: 'high' as const },
  ];

  private readonly promptInjectionPatterns = [
    /ignore\s+(?:previous|all|above)\s+instructions?/i,
    /disregard\s+(?:previous|all|above)\s+instructions?/i,
    /you\s+are\s+now\s+(?:a|the)\s+new/i,
    /forget\s+(?:everything|all)\s+(?:you|we)\s+(?:know|discussed|talked)/i,
    /system\s*(?:prompt|message|instruction)\s*(?:is|was|has)/i,
  ];

  constructor(
    private readonly skillService: SkillService,
    private readonly parser: SkillMdParser,
    private readonly validator: SkillMdValidator,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 从文件映射导入标准技能
   * @param files 文件映射 { 相对路径 → 内容 }
   */
  async importFromFiles(
    files: Map<string, string | Buffer>,
    options: ImportOptions,
    context?: IsolationContext,
  ): Promise<ImportResult> {
    // 1. 提取所有文件
    const extracted: ExtractedFile[] = [];
    for (const [relativePath, content] of files) {
      extracted.push({
        relativePath: relativePath.replace(/\\/g, '/'),
        content: typeof content === 'string' ? content : content.toString('utf-8'),
        isDirectory: false,
      });
    }

    // 2. 找到 SKILL.md
    const skillMdFile = extracted.find(f => f.relativePath.endsWith('SKILL.md'));
    if (!skillMdFile) {
      throw new BadRequestException('未找到 SKILL.md 文件');
    }

    // 3. 解析 SKILL.md
    const rootDir = skillMdFile.relativePath.replace(/\/?SKILL\.md$/, '');
    const parsed = await this.parser.parseFromString(
      skillMdFile.content,
      rootDir || 'imported-skill',
    );

    // 4. 校验
    const validation = this.validator.validate(parsed);
    if (!validation.valid) {
      return {
        success: false,
        skillName: parsed.frontmatter.name || 'unknown',
        mode: options.mode,
        securityScan: { critical: 0, high: 0, medium: 0, low: 0, issues: [], summary: '', passed: true },
        validationErrors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // 5. 安全扫描
    const securityScan = this.securityScan(extracted);

    // 6. 按模式导入
    if (options.mode === 'database') {
      return this.importToDatabase(parsed, extracted, options, context, securityScan, validation);
    } else {
      return this.importToFilesystem(parsed, extracted, options, securityScan, validation);
    }
  }

  /**
   * 安全扫描
   */
  private securityScan(files: ExtractedFile[]): SecurityScanResult {
    const issues: SecurityIssue[] = [];

    for (const file of files) {
      // 扩展名白名单检查
      const ext = path.extname(file.relativePath).toLowerCase();
      if (ext && !this.allowedExtensions.has(ext)) {
        issues.push({
          level: 'high',
          type: '不允许的文件类型',
          file: file.relativePath,
          detail: `扩展名 ${ext} 不在白名单中`,
        });
        continue;
      }

      // 脚本文件检查危险模式
      if (['.py', '.sh', '.js'].includes(ext)) {
        const lines = file.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          for (const { pattern, type, level } of this.blockedScriptPatterns) {
            if (pattern.test(lines[i])) {
              issues.push({
                level,
                type,
                file: file.relativePath,
                detail: `第 ${i + 1} 行匹配危险模式: ${pattern}`,
                line: i + 1,
              });
            }
          }
        }
      }

      // SKILL.md 检查提示注入
      if (file.relativePath.endsWith('SKILL.md')) {
        for (const pattern of this.promptInjectionPatterns) {
          if (pattern.test(file.content)) {
            issues.push({
              level: 'high',
              type: '疑似提示注入',
              file: file.relativePath,
              detail: `匹配注入模式: ${pattern}`,
            });
          }
        }
      }
    }

    const critical = issues.filter(i => i.level === 'critical').length;
    const high = issues.filter(i => i.level === 'high').length;
    const medium = issues.filter(i => i.level === 'medium').length;
    const low = issues.filter(i => i.level === 'low').length;

    return {
      critical,
      high,
      medium,
      low,
      issues,
      summary: `发现 ${critical} 严重、${high} 高危、${medium} 中危、${low} 低危问题`,
      passed: critical === 0,
    };
  }

  /**
   * 导入为 DB 技能
   */
  private async importToDatabase(
    parsed: any,
    files: ExtractedFile[],
    options: ImportOptions,
    context: IsolationContext | undefined,
    securityScan: SecurityScanResult,
    validation: { errors: ValidationError[]; warnings: string[] },
  ): Promise<ImportResult> {
    if (!securityScan.passed) {
      throw new BadRequestException(`安全扫描未通过: ${securityScan.summary}`);
    }

    const fm = parsed.frontmatter;

    // 检查是否已存在
    const existing = await this.skillService.findByCode(fm.name, context).catch(() => null);
    if (existing && !options.overwrite) {
      throw new BadRequestException(`技能 "${fm.name}" 已存在，如需覆盖请设置 overwrite: true`);
    }

    // 确定技能类型
    const hasScripts = files.some(f =>
      f.relativePath.includes('/scripts/') && !f.relativePath.endsWith('/')
    );

    let type = 'FUNCTION';
    let codeType = 'builtin';
    let codeContent = '';

    // 检查是否有 JS 脚本
    const jsScript = files.find(f => f.relativePath.endsWith('.js') && f.relativePath.includes('/scripts/'));
    if (jsScript) {
      type = 'FUNCTION';
      codeType = 'sandbox';
      codeContent = jsScript.content;
    }

    // 根据 metadata 判断
    const skillType = fm.metadata?.skillType;
    if (skillType === 'HTTP' || skillType === 'DATABASE' || skillType === 'MCP') {
      type = skillType;
      codeType = '';
    }

    // 提取参数定义
    const paramsFromBody = this.extractParamsFromBody(parsed.body);

    const createDto = {
      name: fm.name,
      code: fm.name,
      description: fm.description,
      type,
      params: JSON.stringify(paramsFromBody),
      config: JSON.stringify({
        importedFrom: 'agent-skills-standard',
        importedAt: new Date().toISOString(),
        originalFrontmatter: fm,
        hasScripts,
      }),
      status: true,
      timeout: 30000,
      codeType: codeType || undefined,
      codeContent: codeContent || undefined,
      appCode: options.appCode,
      isPublic: options.isPublic ?? false,
    };

    if (existing && options.overwrite) {
      await this.skillService.update(String(existing.id), createDto as any, context);
    } else {
      await this.skillService.create(createDto, context);
    }

    this.logger.log(`技能 "${fm.name}" 已导入为数据库技能`);

    return {
      success: true,
      skillName: fm.name,
      mode: 'database',
      securityScan,
      validationErrors: [],
      warnings: validation.warnings,
    };
  }

  /**
   * 导入为文件系统技能
   */
  private async importToFilesystem(
    parsed: any,
    files: ExtractedFile[],
    options: ImportOptions,
    securityScan: SecurityScanResult,
    validation: { errors: ValidationError[]; warnings: string[] },
  ): Promise<ImportResult> {
    if (!securityScan.passed) {
      throw new BadRequestException(`安全扫描未通过: ${securityScan.summary}`);
    }

    const fs = require('fs/promises');
    const targetDir = options.targetDir || path.join(process.cwd(), 'skills', 'standard');

    // 确定目标子目录
    let skillDir: string;
    if (options.appCode) {
      skillDir = path.join(targetDir, `app-${options.appCode}`, parsed.frontmatter.name);
    } else if (options.isPublic) {
      skillDir = path.join(targetDir, '_public', parsed.frontmatter.name);
    } else {
      skillDir = path.join(targetDir, parsed.frontmatter.name);
    }

    // 创建目录并写入文件
    await fs.mkdir(skillDir, { recursive: true });

    for (const file of files) {
      const relPath = file.relativePath.replace(/^[^/]+\//, ''); // 移除根目录名
      const fullPath = path.join(skillDir, relPath || 'SKILL.md');
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, file.content, 'utf-8');
    }

    this.logger.log(`技能 "${parsed.frontmatter.name}" 已导入到 ${skillDir}`);

    return {
      success: true,
      skillName: parsed.frontmatter.name,
      mode: 'filesystem',
      securityScan,
      validationErrors: [],
      warnings: [
        ...validation.warnings,
        '文件系统导入后需重新扫描技能索引才能被 Agent 发现',
      ],
    };
  }

  /**
   * 从正文中提取参数定义
   */
  private extractParamsFromBody(body: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    const jsonMatch = body.match(/```json\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      } catch { /* ignore */ }
    }
    return params;
  }
}
