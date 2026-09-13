import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as mysql from 'mysql2/promise';
import { checkUpgradeable } from './version-compare.util';
import { encryptAuthCode } from './auth-code.util';

/** 云端版本信息 */
interface CloudVersionInfo {
  version: string;
  remark: string;
}

/** 升级文件状态：pending=待更新 skipped=本地一致 ignored=忽略规则命中 */
export type UpgradeFileStatus = 'pending' | 'skipped' | 'ignored';

/** 升级文件项 */
export interface UpgradeFile {
  /** 云端清单中的相对路径（正斜杠） */
  name: string;
  md5: string;
  status: UpgradeFileStatus;
  localMd5?: string;
}

/** 单文件更新结果 */
interface FileUpdateResult {
  name: string;
  success: boolean;
  error?: string;
}

/** 在线更新报告 */
export interface UpdateReport {
  localVersion: string;
  cloudVersion: string;
  targetVersion: string;
  upgradeable: boolean;
  message: string;
  files: UpgradeFile[];
  results: FileUpdateResult[];
  sqlExecuted: boolean;
  sqlError?: string;
  versionApplied: boolean;
  /** 更新完成后需重启服务进程，新代码才生效（Node 与 php 不同，不会自动加载新文件） */
  restartRequired: boolean;
}

const AUTH_CODE_KEY = 'muu';
const AUTH_CODE_EXPIRY = 6000;

/**
 * 中台框架在线更新服务（MuuAgent-Middle-Platform-Framework 自更新）
 *
 * 复刻 php_server 在线更新客户端流程（php_server/app/admin/controller/Update.php +
 * app/admin/lib/Upgrade.php）：请求云端查版本 → 本地对比 → 取升级清单（md5 过滤）→
 * 逐文件下载替换（先备份）→ 执行升级 SQL → 更新本地版本号
 */
@Injectable()
export class SystemUpdaterService {
  private readonly logger = new Logger(SystemUpdaterService.name);
  /** 防止并发执行更新 */
  private running = false;
  /** 备份目录中记录的更新前版本号 */
  private backupVersion = '';

  constructor(private readonly config: ConfigService) {}

  // ==================== 配置 ====================

  /** 云端更新服务器地址（以 / 结尾） */
  private get cloudApi(): string {
    const api = this.config.get<string>('SYSTEM_UPDATER_CLOUD_API') || '';
    return api.endsWith('/') ? api : `${api}/`;
  }

  /** 中台仓库根目录（更新目标，VERSION 文件所在目录） */
  private get targetRoot(): string {
    return this.config.get<string>('SYSTEM_UPDATER_SERVER_ROOT') || '';
  }

  private get appName(): string {
    return this.config.get<string>('SYSTEM_UPDATER_APP_NAME') || 'muuagent';
  }

  private get frame(): string {
    return this.config.get<string>('SYSTEM_UPDATER_FRAME') || 'muuagent';
  }

  private get domain(): string {
    return this.config.get<string>('SYSTEM_UPDATER_DOMAIN') || '';
  }

  private get ip(): string {
    return this.config.get<string>('SYSTEM_UPDATER_IP') || '';
  }

  /**
   * 生成授权码（php Cloud::authCode 语义：加密 `domain|ip`）
   * 系统更新不需要授权，未配置域名/IP 时返回空串
   */
  private buildAuthCode(): string {
    if (!this.domain && !this.ip) return '';
    return encryptAuthCode(`${this.domain}|${this.ip}`, AUTH_CODE_EXPIRY, AUTH_CODE_KEY);
  }

  // ==================== 版本检查 ====================

  /** 读取本地版本号（中台仓库根目录 VERSION 文件） */
  async getLocalVersion(): Promise<string> {
    const file = path.join(this.targetRoot, 'VERSION');
    if (!fs.existsSync(file)) {
      throw new Error(`未找到本地版本文件: ${file}`);
    }
    return (await fs.promises.readFile(file, 'utf-8')).trim();
  }

  /** 请求云端获取最新版本（POST app/version，form-urlencoded） */
  async getCloudVersion(): Promise<CloudVersionInfo> {
    const body = new URLSearchParams({
      app_name: this.appName,
      frame: this.frame,
      domain: this.domain,
      ip: this.ip,
    });
    const { data } = await axios.post(`${this.cloudApi}app/version`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    if (data?.code !== 200 || !data?.data?.version) {
      throw new Error(data?.msg || '云端版本查询失败');
    }
    return {
      version: String(data.data.version),
      remark: String(data.data.remark ?? ''),
    };
  }

  /** 检查云端是否有比本地更高的版本 */
  async checkUpdate(): Promise<{
    localVersion: string;
    cloudVersion: string;
    remark: string;
    upgradeable: boolean;
  }> {
    const localVersion = await this.getLocalVersion();
    const cloud = await this.getCloudVersion();
    return {
      localVersion,
      cloudVersion: cloud.version,
      remark: cloud.remark,
      upgradeable: checkUpgradeable(localVersion, cloud.version),
    };
  }

  // ==================== 升级清单 ====================

  /**
   * 获取待更新文件清单（POST upgrade/{app_name}/version）
   *
   * 复刻 php buildJson 过滤逻辑：命中忽略规则跳过；本地文件存在且 md5 一致跳过
   */
  async getUpgradeFileList(version: string): Promise<UpgradeFile[]> {
    const body = new URLSearchParams({
      app_name: this.appName,
      frame: this.frame,
      version,
      auth_code: this.buildAuthCode(),
    });
    const { data } = await axios.post(`${this.cloudApi}upgrade/${this.appName}/version`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    if (data?.code !== 200) {
      throw new Error(data?.msg || '获取升级清单失败');
    }
    const files = data?.data?.data;
    if (!Array.isArray(files)) {
      throw new Error('升级清单格式错误');
    }
    return files.map((item: { name: string; md5: string }) =>
      this.analyzeFile(String(item.name), String(item.md5)),
    );
  }

  /** 分析单个文件与本地差异，归类状态 */
  private analyzeFile(rawName: string, md5: string): UpgradeFile {
    const name = rawName.replace(/\\/g, '/');
    if (this.isIgnoredFile(name)) {
      return { name, md5, status: 'ignored' };
    }
    const localPath = path.resolve(this.targetRoot, name);
    let localMd5: string | undefined;
    if (fs.existsSync(localPath)) {
      localMd5 = this.md5File(localPath);
    }
    if (localMd5 && localMd5 === md5) {
      return { name, md5, status: 'skipped', localMd5 };
    }
    return { name, md5, status: 'pending', localMd5 };
  }

  /**
   * 忽略文件规则（复刻 php Upgrade::checkIgnoreFile 的子串匹配）
   */
  private isIgnoredFile(name: string): boolean {
    // 保护本地环境与运行产物：子串匹配（复刻 php Upgrade::checkIgnoreFile 规则）
    // 注意 VERSION 不从清单更新，由 applyVersion() 写入；uploads/logs 为本地运行数据
    const ignoreItems = [
      '.env',
      'node_modules/',
      '.git/',
      '.idea',
      '.gitignore',
      'uploads/',
      'logs/',
      'backups/',
      'VERSION',
    ];
    return ignoreItems.some((item) => name.includes(item));
  }

  // ==================== 文件下载替换 ====================

  /**
   * 下载云端文件并替换本地（GET upgrade/download，octet-stream 分流），
   * 已存在的文件先备份到 backups/{Y-m}/{d}/{旧版本}/
   */
  async downloadAndReplace(file: UpgradeFile, version: string): Promise<void> {
    const params = new URLSearchParams({
      app_name: this.appName,
      version,
      md5: file.md5,
      frame: this.frame,
    });
    const authCode = this.buildAuthCode();
    if (authCode) params.set('auth_code', authCode);

    const response = await axios.get(`${this.cloudApi}upgrade/download?${params.toString()}`, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: Infinity,
    });

    // 复刻 php downFile：非 octet-stream 的响应当 JSON 错误处理
    const contentType = String(response.headers['content-type'] || '');
    if (contentType.includes('application/json')) {
      const err = JSON.parse(Buffer.from(response.data).toString('utf-8'));
      throw new Error(err?.msg || '云端下载失败');
    }
    if (!contentType.includes('application/octet-stream')) {
      throw new Error(`云端下载返回异常 content-type: ${contentType}`);
    }

    const localPath = this.resolveLocalPath(file.name);
    await this.backupFile(localPath);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, Buffer.from(response.data));
    this.logger.log(`已更新文件: ${file.name}`);
  }

  /** 解析本地目标路径，防止路径穿越 */
  private resolveLocalPath(name: string): string {
    const root = path.resolve(this.targetRoot);
    const resolved = path.resolve(root, name);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new Error(`非法文件路径: ${name}`);
    }
    return resolved;
  }

  /** 备份已存在的本地文件（复刻 php Upgrade::backup 目录规则） */
  private async backupFile(localPath: string): Promise<void> {
    if (!fs.existsSync(localPath)) return;
    const rel = path.relative(path.resolve(this.targetRoot), localPath).replace(/\\/g, '/');
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const day = String(now.getDate()).padStart(2, '0');
    const backupPath = path.join(
      path.resolve(this.targetRoot),
      'backups',
      ym,
      day,
      this.backupVersion || 'unknown',
      rel,
    );
    await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.promises.copyFile(localPath, backupPath);
  }

  private md5File(filePath: string): string {
    return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
  }

  // ==================== SQL 与版本号 ====================

  /**
   * 执行升级 SQL（中台仓库根目录 upgrade.sql，复刻 php executeUpgradeSql：
   * muucmf_ 占位前缀替换为实际前缀（SYSTEM_UPDATER_DB_PREFIX），逐条执行并忽略单条错误）
   * 数据库连接：优先 SYSTEM_UPDATER_DB_URL，缺省读取中台自身 DATABASE_URL
   * @returns 是否执行了 SQL（文件不存在返回 false）
   */
  async executeUpgradeSql(): Promise<boolean> {
    const sqlPath = path.join(path.resolve(this.targetRoot), 'upgrade.sql');
    if (!fs.existsSync(sqlPath)) return false;

    const db = this.parseDatabaseUrl();
    if (!db || !db.database) {
      throw new Error('存在 upgrade.sql 但未配置 MySQL DATABASE_URL（或 SYSTEM_UPDATER_DB_URL），无法执行升级 SQL');
    }

    const content = await fs.promises.readFile(sqlPath, 'utf-8');
    const statements = this.parseSqlStatements(content);
    if (!statements.length) return false;

    const prefix = this.config.get<string>('SYSTEM_UPDATER_DB_PREFIX') || 'muucmf_';
    const connection = await mysql.createConnection({
      ...db,
      multipleStatements: false,
    });
    try {
      for (const statement of statements) {
        const sql = prefix === 'muucmf_' ? statement : statement.replaceAll('muucmf_', prefix);
        try {
          await connection.query(sql);
        } catch (error) {
          // 复刻 php：忽略单条 SQL 错误继续执行
          this.logger.warn(`升级 SQL 执行失败（已忽略）: ${(error as Error).message}`);
        }
      }
    } finally {
      await connection.end();
    }
    return true;
  }

  /** 解析升级 SQL 的数据库连接：优先 SYSTEM_UPDATER_DB_URL，回退 DATABASE_URL */
  private parseDatabaseUrl(): {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  } | null {
    const url = this.config.get<string>('SYSTEM_UPDATER_DB_URL') || this.config.get<string>('DATABASE_URL') || '';
    if (!url) return null;
    try {
      const u = new URL(url);
      if (!u.protocol.startsWith('mysql')) return null;
      return {
        host: u.hostname || '127.0.0.1',
        port: Number(u.port) || 3306,
        user: decodeURIComponent(u.username) || 'root',
        password: decodeURIComponent(u.password) || '',
        database: u.pathname.replace(/^\//, ''),
      };
    } catch {
      return null;
    }
  }

  /** 简易 SQL 语句切分：去块注释与整行注释，按分号切分 */
  private parseSqlStatements(content: string): string[] {
    const noBlockComment = content.replace(/\/\*[\s\S]*?\*\//g, '');
    const lines = noBlockComment.split(/\r?\n/).filter((line) => {
      const trimmed = line.trim();
      return trimmed !== '' && !trimmed.startsWith('--') && !trimmed.startsWith('#');
    });
    return lines
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** 更新本地版本号（写中台仓库根目录 VERSION 文件） */
  async applyVersion(version: string): Promise<void> {
    await fs.promises.writeFile(path.join(path.resolve(this.targetRoot), 'VERSION'), `${version}\n`, 'utf-8');
  }

  // ==================== 完整更新编排 ====================

  /**
   * 执行在线更新完整流程
   * @param options.version 指定目标版本（默认取云端最新版本）
   * @param options.dryRun 预览模式，仅返回待更新文件清单不落盘
   */
  async runUpdate(options: { version?: string; dryRun?: boolean } = {}): Promise<UpdateReport> {
    if (this.running) {
      throw new Error('更新任务正在进行中，请勿重复执行');
    }
    this.running = true;
    try {
      const localVersion = await this.getLocalVersion();
      const cloud = await this.getCloudVersion();
      const targetVersion = options.version || cloud.version;
      const upgradeable = checkUpgradeable(localVersion, targetVersion);

      if (!upgradeable) {
        return {
          localVersion,
          cloudVersion: cloud.version,
          targetVersion,
          upgradeable: false,
          message: '已经是最新版本',
          files: [],
          results: [],
          sqlExecuted: false,
          versionApplied: false,
          restartRequired: false,
        };
      }

      const files = await this.getUpgradeFileList(targetVersion);

      if (options.dryRun) {
        return {
          localVersion,
          cloudVersion: cloud.version,
          targetVersion,
          upgradeable: true,
          message: '预览模式，未执行更新',
          files,
          results: [],
          sqlExecuted: false,
          versionApplied: false,
          restartRequired: false,
        };
      }

      // 备份目录记录更新前版本号
      this.backupVersion = localVersion;

      const results: FileUpdateResult[] = [];
      const pending = files.filter((f) => f.status === 'pending');
      for (const file of pending) {
        try {
          await this.downloadAndReplace(file, targetVersion);
          results.push({ name: file.name, success: true });
        } catch (error) {
          // 单文件失败记录后继续（复刻 php 逐文件更新语义）
          const message = (error as Error).message;
          this.logger.error(`文件更新失败: ${file.name} - ${message}`);
          results.push({ name: file.name, success: false, error: message });
        }
      }

      let sqlExecuted = false;
      let sqlError: string | undefined;
      try {
        sqlExecuted = await this.executeUpgradeSql();
      } catch (error) {
        sqlError = (error as Error).message;
      }

      await this.applyVersion(targetVersion);

      return {
        localVersion,
        cloudVersion: cloud.version,
        targetVersion,
        upgradeable: true,
        message: '更新完成，请重启服务使新版本生效',
        files,
        results,
        sqlExecuted,
        sqlError,
        versionApplied: true,
        restartRequired: true,
      };
    } finally {
      this.running = false;
      this.backupVersion = '';
    }
  }
}
