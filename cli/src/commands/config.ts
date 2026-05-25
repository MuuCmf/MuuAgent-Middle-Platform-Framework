import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot, getProjectPaths, parseEnvFile } from '../utils/project.js';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * 配置检查项
 */
interface ConfigCheckItem {
  /** 配置项名称 */
  key: string;
  /** 是否必填 */
  required: boolean;
  /** 当前值（脱敏） */
  value: string;
  /** 状态 */
  status: 'ok' | 'missing' | 'default' | 'warn';
  /** 说明 */
  description: string;
}

/**
 * 敏感配置项列表（值需要脱敏）
 */
const SENSITIVE_KEYS = ['JWT_SECRET', 'DATABASE_URL', 'REDIS_PASSWORD'];

/**
 * 对敏感值进行脱敏处理
 * @param key 配置项名称
 * @param value 原始值
 * @returns {string} 脱敏后的值
 */
function maskValue(key: string, value: string): string {
  if (!SENSITIVE_KEYS.includes(key)) {
    return value;
  }
  if (value.length <= 8) {
    return '****';
  }
  return value.slice(0, 4) + '****' + value.slice(-4);
}

/**
 * 检测是否为默认/不安全值
 * @param key 配置项名称
 * @param value 当前值
 * @returns {boolean} 是否为默认值
 */
function isDefaultValue(key: string, value: string): boolean {
  const defaults: Record<string, string[]> = {
    JWT_SECRET: ['your-jwt-secret-key-change-in-production', 'change', 'Change', 'CHANGE'],
  };

  const patterns = defaults[key];
  if (!patterns) return false;
  return patterns.some((p) => value.includes(p));
}

/**
 * 注册 config 命令组
 * @returns {Command} Commander 命令实例
 */
export function createConfigCommand(): Command {
  const config = new Command('config')
    .description('配置管理工具');

  /** config check */
  config
    .command('check')
    .description('校验 .env 配置完整性')
    .option('--show-values', '显示完整配置值（不脱敏）', false)
    .action(async (options: { showValues: boolean }) => {
      const { rootDir, found } = findProjectRoot();
      if (!found) {
        console.error(chalk.red('未找到 MuuAgent 项目根目录'));
        process.exit(1);
      }

      const paths = getProjectPaths(rootDir);
      const envPath = join(paths.service, '.env');
      const examplePath = join(paths.service, '.env.example');

      console.log(chalk.cyan('MuuAgent 配置校验\n'));
      console.log(chalk.gray('──────────────────────────────\n'));

      /** 检查 .env 文件是否存在 */
      if (!existsSync(envPath)) {
        console.log(chalk.red('✗ .env 文件不存在'));
        if (existsSync(examplePath)) {
          console.log(chalk.gray(`\n  请复制 .env.example 并配置:`));
          console.log(chalk.cyan(`  cp ${examplePath} ${envPath}`));
        }
        process.exit(1);
      }

      /** 解析 .env 和 .env.example */
      const envVars = parseEnvFile(envPath);
      const exampleVars = existsSync(examplePath) ? parseEnvFile(examplePath) : {};

      /** 定义必填配置项 */
      const requiredKeys = [
        { key: 'DATABASE_URL', desc: '数据库连接地址' },
        { key: 'PORT', desc: '服务端口' },
        { key: 'JWT_SECRET', desc: 'JWT 签名密钥' },
      ];

      /** 定义可选配置项 */
      const optionalKeys = [
        { key: 'REDIS_URL', desc: 'Redis 连接地址（限流/缓存）' },
        { key: 'QDRANT_URL', desc: 'Qdrant 向量数据库地址（知识库）' },
        { key: 'LOG_LEVEL', desc: '日志级别' },
        { key: 'NODE_ENV', desc: '运行环境' },
      ];

      const checks: ConfigCheckItem[] = [];

      /** 检查必填项 */
      for (const { key, desc } of requiredKeys) {
        const value = envVars[key];
        if (!value) {
          checks.push({ key, required: true, value: '-', status: 'missing', description: desc });
        } else if (isDefaultValue(key, value)) {
          checks.push({
            key,
            required: true,
            value: options.showValues ? value : maskValue(key, value),
            status: 'default',
            description: desc,
          });
        } else {
          checks.push({
            key,
            required: true,
            value: options.showValues ? value : maskValue(key, value),
            status: 'ok',
            description: desc,
          });
        }
      }

      /** 检查可选项 */
      for (const { key, desc } of optionalKeys) {
        const value = envVars[key];
        if (!value) {
          checks.push({ key, required: false, value: '-', status: 'warn', description: desc });
        } else {
          checks.push({
            key,
            required: false,
            value: options.showValues ? value : maskValue(key, value),
            status: 'ok',
            description: desc,
          });
        }
      }

      /** 检查 .env.example 中有但 .env 中没有的项 */
      const missingFromEnv = Object.keys(exampleVars).filter((k) => !envVars[k]);
      if (missingFromEnv.length > 0) {
        console.log(chalk.yellow(`⚠ .env.example 中有 ${missingFromEnv.length} 个配置项在 .env 中缺失:`));
        for (const key of missingFromEnv) {
          console.log(chalk.gray(`  - ${key}`));
        }
        console.log();
      }

      /** 输出检查结果 */
      let errorCount = 0;
      let warnCount = 0;

      console.log(chalk.bold('必填配置:'));
      for (const check of checks.filter((c) => c.required)) {
        let icon: string;
        let color: (text: string) => string;

        switch (check.status) {
          case 'ok':
            icon = '✓';
            color = chalk.green;
            break;
          case 'missing':
            icon = '✗';
            color = chalk.red;
            errorCount++;
            break;
          case 'default':
            icon = '⚠';
            color = chalk.yellow;
            warnCount++;
            break;
          default:
            icon = '·';
            color = chalk.gray;
        }

        console.log(`  ${color(icon)} ${chalk.bold(check.key)} = ${color(check.value)} ${chalk.gray(check.description)}`);
      }

      console.log();
      console.log(chalk.bold('可选配置:'));
      for (const check of checks.filter((c) => !c.required)) {
        let icon: string;
        let color: (text: string) => string;

        switch (check.status) {
          case 'ok':
            icon = '✓';
            color = chalk.green;
            break;
          case 'warn':
            icon = '⚠';
            color = chalk.yellow;
            warnCount++;
            break;
          default:
            icon = '·';
            color = chalk.gray;
        }

        console.log(`  ${color(icon)} ${chalk.bold(check.key)} = ${color(check.value)} ${chalk.gray(check.description)}`);
      }

      console.log(chalk.gray('\n──────────────────────────────'));
      console.log(`  ${chalk.green(`通过: ${checks.length - errorCount - warnCount}`)} | ${chalk.yellow(`警告: ${warnCount}`)} | ${chalk.red(`错误: ${errorCount}`)}`);

      if (errorCount > 0) {
        process.exit(1);
      }
    });

  return config;
}
