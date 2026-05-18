import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { SkillMdParser } from './skill-md-parser';
import { SkillMdValidator, SkillFrontmatter, ValidationError } from './skill-md-validator';

/**
 * 技能索引条目（仅 L1 元数据，不包含正文）
 */
export interface SkillIndexEntry {
  name: string;
  description: string;
  source: 'filesystem';
  directoryPath: string;
  skillMdPath: string;
  frontmatter: SkillFrontmatter;
  discoveredAt: Date;
  fileSize: number;
  hasScripts: boolean;
  hasReferences: boolean;
  hasAssets: boolean;
  appCode: string | null;
  isPublic: boolean;
}

/**
 * 扫描配置
 */
export interface ScannerConfig {
  rootDirs: string[];
  excludePatterns: string[];
  appCode?: string;
  watchEnabled?: boolean;
}

/**
 * 扫描结果
 */
export interface ScanResult {
  skills: SkillIndexEntry[];
  errors: Array<{ path: string; errors: ValidationError[] }>;
  scanDuration: number;
}

const DEFAULT_CONFIG: ScannerConfig = {
  rootDirs: [path.join(process.cwd(), 'skills', 'standard')],
  excludePatterns: ['node_modules', '.git', '__pycache__', '.DS_Store'],
  watchEnabled: false,
};

/**
 * 文件系统技能发现器
 * 扫描指定目录，递归查找所有 SKILL.md，建立 L1 元数据索引
 */
@Injectable()
export class SkillScanner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SkillScanner.name);
  private readonly index = new Map<string, SkillIndexEntry>();
  private config: ScannerConfig = DEFAULT_CONFIG;
  private watcher: chokidar.FSWatcher | null = null;
  private scanDebounceTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly parser: SkillMdParser,
    private readonly validator: SkillMdValidator,
  ) {}

  async onModuleInit() {
    await this.scan();
    if (this.config.watchEnabled) {
      this.startWatch();
    }
  }

  async onModuleDestroy() {
    this.stopWatch();
  }

  /**
   * 更新扫描配置
   */
  configure(config: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  /**
   * 获取完整索引
   * @param appCode 可选的应用标识筛选，返回该应用的技能 + 公开技能
   */
  getIndex(appCode?: string): SkillIndexEntry[] {
    const all = Array.from(this.index.values());
    if (!appCode) return all;
    return all.filter(e => e.appCode === appCode || e.isPublic);
  }

  /**
   * 按名称查找
   */
  findByName(name: string): SkillIndexEntry | undefined {
    return this.index.get(name);
  }

  /**
   * 按应用过滤
   */
  findByAppCode(appCode: string): SkillIndexEntry[] {
    return this.getIndex().filter(
      e => e.appCode === appCode || e.isPublic,
    );
  }

  /**
   * 执行全量扫描
   */
  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    const errors: Array<{ path: string; errors: ValidationError[] }> = [];

    this.logger.log(`开始扫描技能目录: ${this.config.rootDirs.join(', ')}`);

    const newIndex = new Map<string, SkillIndexEntry>();

    for (const rootDir of this.config.rootDirs) {
      try {
        await fs.access(rootDir);
      } catch {
        this.logger.warn(`技能目录不存在，跳过: ${rootDir}`);
        continue;
      }

      const discovered = await this.scanDirectory(rootDir, errors);
      for (const entry of discovered) {
        newIndex.set(entry.name, entry);
      }
    }

    // 原子替换索引
    this.index.clear();
    for (const [key, value] of newIndex) {
      this.index.set(key, value);
    }

    const scanDuration = Date.now() - startTime;
    this.logger.log(
      `扫描完成: ${this.index.size} 个技能, ${errors.length} 个错误, 耗时 ${scanDuration}ms`,
    );

    return {
      skills: this.getIndex(),
      errors,
      scanDuration,
    };
  }

  /**
   * 递归扫描单个目录
   */
  private async scanDirectory(
    dirPath: string,
    errors: Array<{ path: string; errors: ValidationError[] }>,
  ): Promise<SkillIndexEntry[]> {
    const results: SkillIndexEntry[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // 先检查当前目录是否是技能目录
      const inspection = await this.parser.inspectDirectory(dirPath);
      if (inspection.hasSkillMd && inspection.skillMdPath) {
        try {
          const parsed = await this.parser.parseFromFile(inspection.skillMdPath);
          const validation = this.validator.validate(parsed);
          if (!validation.valid) {
            errors.push({ path: inspection.skillMdPath, errors: validation.errors });
          }

          const stat = await fs.stat(inspection.skillMdPath);
          const entry = this.buildIndexEntry(parsed, inspection, stat.size, dirPath);
          results.push(entry);
          return results; // 技能目录不再递归
        } catch (err) {
          this.logger.warn(`解析 SKILL.md 失败: ${inspection.skillMdPath} — ${(err as Error).message}`);
          return results;
        }
      }

      // 非技能目录，递归子目录
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (this.config.excludePatterns.includes(entry.name)) continue;

        const subDir = path.join(dirPath, entry.name);
        const subResults = await this.scanDirectory(subDir, errors);
        results.push(...subResults);
      }
    } catch (err) {
      this.logger.warn(`读取目录失败: ${dirPath} — ${(err as Error).message}`);
    }

    return results;
  }

  /**
   * 构建索引条目，自动识别多租户信息
   */
  private buildIndexEntry(
    parsed: { frontmatter: SkillFrontmatter; body: string; bodyTokens: number; rawYaml: string; filePath: string; directoryPath: string },
    inspection: { hasScripts: boolean; hasReferences: boolean; hasAssets: boolean },
    fileSize: number,
    dirPath: string,
  ): SkillIndexEntry {
    const { appCode, isPublic } = this.resolveTenantInfo(dirPath);

    return {
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      source: 'filesystem',
      directoryPath: parsed.directoryPath,
      skillMdPath: parsed.filePath,
      frontmatter: parsed.frontmatter,
      discoveredAt: new Date(),
      fileSize,
      hasScripts: inspection.hasScripts,
      hasReferences: inspection.hasReferences,
      hasAssets: inspection.hasAssets,
      appCode,
      isPublic,
    };
  }

  /**
   * 根据目录层级解析多租户信息
   *
   * 目录结构约定：
   *   skills/standard/_public/  → 公开技能
   *   skills/standard/app-{code}/ → 归属特定应用的技能
   *   其他 → 公开技能（默认）
   */
  private resolveTenantInfo(dirPath: string): { appCode: string | null; isPublic: boolean } {
    // 找到技能目录相对于最近的 rootDir 的路径段
    for (const rootDir of this.config.rootDirs) {
      const normalizedRoot = path.resolve(rootDir);
      const normalizedDir = path.resolve(dirPath);

      if (normalizedDir.startsWith(normalizedRoot)) {
        const relativePath = path.relative(normalizedRoot, normalizedDir);
        const segments = relativePath.split(path.sep).filter(Boolean);

        if (segments.length === 0) continue;

        // 检查是否直接位于 _public 下
        const parentDir = path.dirname(dirPath);
        const parentSegments = path.relative(normalizedRoot, parentDir).split(path.sep).filter(Boolean);

        if (parentSegments.length === 1 && parentSegments[0] === '_public') {
          return { appCode: null, isPublic: true };
        }

        // app-{code} 模式
        if (parentSegments.length === 1) {
          const appDir = parentSegments[0];
          const match = appDir.match(/^app-(.+)$/);
          if (match) {
            return { appCode: match[1], isPublic: false };
          }
        }

        // 默认公开
        return { appCode: null, isPublic: true };
      }
    }

    return { appCode: null, isPublic: true };
  }

  /**
   * 启动文件监听，技能目录变更时自动增量扫描
   */
  startWatch(): void {
    if (this.watcher) return;

    const watchPaths = this.config.rootDirs.filter(dir => {
      try { require('fs').accessSync(dir); return true; } catch { return false; }
    });

    if (watchPaths.length === 0) {
      this.logger.warn('没有可监听的技能目录');
      return;
    }

    this.watcher = chokidar.watch(watchPaths, {
      ignored: [
        /(^|[\/\\])\../, // 隐藏文件
        '**/node_modules/**',
        '**/.git/**',
        '**/__pycache__/**',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    this.watcher.on('all', (event, filePath) => {
      if (!filePath.endsWith('SKILL.md')) return;
      this.logger.log(`检测到技能文件变更 [${event}]: ${filePath}`);
      this.debouncedScan();
    });

    this.logger.log(`文件监听已启动，监控 ${watchPaths.length} 个目录`);
  }

  /**
   * 停止文件监听
   */
  stopWatch(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger.log('文件监听已停止');
    }
    if (this.scanDebounceTimer) {
      clearTimeout(this.scanDebounceTimer);
      this.scanDebounceTimer = null;
    }
  }

  /**
   * 防抖扫描，500ms 内的多次变更合并为一次扫描
   */
  private debouncedScan(): void {
    if (this.scanDebounceTimer) {
      clearTimeout(this.scanDebounceTimer);
    }
    this.scanDebounceTimer = setTimeout(async () => {
      this.scanDebounceTimer = null;
      try {
        await this.scan();
        this.logger.log('增量扫描完成');
      } catch (err) {
        this.logger.error(`增量扫描失败: ${(err as Error).message}`);
      }
    }, 500);
  }

  /**
   * 清除索引
   */
  clearIndex(): void {
    this.index.clear();
    this.logger.log('技能索引已清除');
  }

  /**
   * 构建同步到数据库的条目
   * 读取完整的技能内容和参考文档
   */
  async buildSyncEntries(): Promise<Array<{
    name: string;
    description: string;
    directoryPath: string;
    skillMdPath: string;
    frontmatter: SkillFrontmatter;
    hasScripts: boolean;
    hasReferences: boolean;
    hasAssets: boolean;
    appCode: string | null;
    isPublic: boolean;
    instructions: string;
    allowedTools?: string[];
    references?: Array<{ filePath: string; content: string }>;
  }>> {
    const entries: Array<{
      name: string;
      description: string;
      directoryPath: string;
      skillMdPath: string;
      frontmatter: SkillFrontmatter;
      hasScripts: boolean;
      hasReferences: boolean;
      hasAssets: boolean;
      appCode: string | null;
      isPublic: boolean;
      instructions: string;
      allowedTools?: string[];
      references?: Array<{ filePath: string; content: string }>;
    }> = [];

    for (const [, indexEntry] of this.index) {
      try {
        // 解析技能完整内容
        const parsed = await this.parser.parseFromFile(indexEntry.skillMdPath);
        
        // 加载参考文档
        let references: Array<{ filePath: string; content: string }> | undefined;
        if (indexEntry.hasReferences) {
          references = await this.loadReferences(indexEntry.directoryPath);
        }

        entries.push({
          name: indexEntry.name,
          description: indexEntry.description,
          directoryPath: indexEntry.directoryPath,
          skillMdPath: indexEntry.skillMdPath,
          frontmatter: indexEntry.frontmatter,
          hasScripts: indexEntry.hasScripts,
          hasReferences: indexEntry.hasReferences,
          hasAssets: indexEntry.hasAssets,
          appCode: indexEntry.appCode,
          isPublic: indexEntry.isPublic,
          instructions: parsed.body,
          allowedTools: parsed.frontmatter.allowedTools
            ? parsed.frontmatter.allowedTools.split(/\s+/).filter(Boolean)
            : undefined,
          references,
        });
      } catch (err) {
        this.logger.warn(`构建同步条目失败 - ${indexEntry.name}: ${(err as Error).message}`);
      }
    }

    return entries;
  }

  /**
   * 加载技能目录下的所有参考文档
   */
  private async loadReferences(directoryPath: string): Promise<Array<{ filePath: string; content: string }>> {
    const references: Array<{ filePath: string; content: string }> = [];
    const refDir = path.join(directoryPath, 'references');

    try {
      const files = await fs.readdir(refDir);
      
      for (const fileName of files) {
        const filePath = path.join(refDir, fileName);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile()) {
          const content = await fs.readFile(filePath, 'utf-8');
          references.push({ filePath: fileName, content });
        }
      }
    } catch {
      // 忽略读取失败
    }

    return references;
  }
}
