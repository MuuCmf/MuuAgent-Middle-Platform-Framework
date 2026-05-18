import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SkillMdParser } from './standard/skill-md-parser';
import { SkillMdValidator, ValidationError } from './standard/skill-md-validator';
import { IsolationContext } from '../common/utils/isolation.util';
import * as path from 'path';

/**
 * 导入选项
 */
export interface ImportOptions {
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
 * 负责导入 Agent Skills 标准格式的技能到文件系统
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
    private readonly parser: SkillMdParser,
    private readonly validator: SkillMdValidator,
  ) {}

  /**
   * 从文件映射导入标准技能到文件系统
   */
  async importFromFiles(
    files: Map<string, string | Buffer>,
    options: ImportOptions = {},
    _context?: IsolationContext,
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
        securityScan: { critical: 0, high: 0, medium: 0, low: 0, issues: [], summary: '', passed: true },
        validationErrors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // 5. 安全扫描
    const securityScan = this.securityScan(extracted);

    // 6. 写入文件系统
    return this.writeToFilesystem(parsed, extracted, options, securityScan, validation);
  }

  /**
   * 安全扫描
   */
  private securityScan(files: ExtractedFile[]): SecurityScanResult {
    const issues: SecurityIssue[] = [];

    for (const file of files) {
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
        const fmMatch = file.content.match(/^---\s*\n([\s\S]*?)\n---/);
        const fmContent = fmMatch ? fmMatch[1] : '';

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
        // 检查 metadata 值中是否包含注入
        const metaMatch = fmContent.match(/metadata:\s*\n([\s\S]*?)(?:\n\w|$)/);
        if (metaMatch) {
          for (const pattern of this.promptInjectionPatterns) {
            if (pattern.test(metaMatch[1])) {
              issues.push({
                level: 'high',
                type: '疑似提示注入（metadata）',
                file: file.relativePath,
                detail: `metadata 值匹配注入模式: ${pattern}`,
              });
            }
          }
        }
        // 检查 description 中是否包含注入
        const descMatch = fmContent.match(/^description:\s*(.+)$/m);
        if (descMatch) {
          for (const pattern of this.promptInjectionPatterns) {
            if (pattern.test(descMatch[1])) {
              issues.push({
                level: 'high',
                type: '疑似提示注入（description）',
                file: file.relativePath,
                detail: `description 匹配注入模式: ${pattern}`,
              });
            }
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
      passed: critical === 0 && high === 0,
    };
  }

  /**
   * 写入文件系统
   */
  private async writeToFilesystem(
    parsed: any,
    files: ExtractedFile[],
    options: ImportOptions,
    securityScan: SecurityScanResult,
    validation: { errors: ValidationError[]; warnings: string[] },
  ): Promise<ImportResult> {
    if (!securityScan.passed) {
      throw new BadRequestException(`安全扫描未通过: ${securityScan.summary}`);
    }

    const fs = await import('fs/promises');
    const targetDir = options.targetDir || path.join(process.cwd(), 'skills', 'standard');

    let skillDir: string;
    if (options.appCode) {
      skillDir = path.join(targetDir, `app-${options.appCode}`, parsed.frontmatter.name);
    } else if (options.isPublic) {
      skillDir = path.join(targetDir, '_public', parsed.frontmatter.name);
    } else {
      skillDir = path.join(targetDir, parsed.frontmatter.name);
    }

    // 使用临时目录写入，成功后再重命名（原子性导入）
    const tmpDir = skillDir + '.tmp-' + Date.now();
    const createdPaths: string[] = [];

    try {
      await fs.mkdir(tmpDir, { recursive: true });
      createdPaths.push(tmpDir);

      for (const file of files) {
        const relPath = file.relativePath.replace(/^[^/]+\//, '');
        const fullPath = path.join(tmpDir, relPath || 'SKILL.md');
        const dir = path.dirname(fullPath);
        await fs.mkdir(dir, { recursive: true });
        createdPaths.push(fullPath);
        await fs.writeFile(fullPath, file.content, 'utf-8');
      }

      // 原子性替换：如果目标已存在，先备份
      let backupDir: string | null = null;
      try {
        await fs.access(skillDir);
        backupDir = skillDir + '.backup-' + Date.now();
        await fs.rename(skillDir, backupDir);
      } catch { /* 目标不存在，无需备份 */ }

      try {
        await fs.rename(tmpDir, skillDir);
        if (backupDir) {
          await fs.rm(backupDir, { recursive: true, force: true });
        }
      } catch (renameErr) {
        if (backupDir) {
          try { await fs.rename(backupDir, skillDir); } catch { /* ignore */ }
        }
        throw renameErr;
      }

      this.logger.log(`技能 "${parsed.frontmatter.name}" 已导入到 ${skillDir}`);
    } catch (err) {
      // 清理临时文件和备份
      for (const p of createdPaths.reverse()) {
        try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ignore */ }
      }
      const backups = await fs.readdir(targetDir).catch(() => []);
      for (const name of backups) {
        if (name.startsWith(parsed.frontmatter.name + '.backup-')) {
          try { await fs.rm(path.join(targetDir, name), { recursive: true, force: true }); } catch { /* ignore */ }
        }
      }
      throw new BadRequestException(
        `写入文件系统失败: ${(err as Error).message}`,
      );
    }

    return {
      success: true,
      skillName: parsed.frontmatter.name,
      securityScan,
      validationErrors: [],
      warnings: [
        ...validation.warnings,
        '文件系统导入后需重新扫描技能索引才能被 Agent 发现',
      ],
    };
  }
}
