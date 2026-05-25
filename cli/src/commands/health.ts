import { Command } from 'commander';
import chalk from 'chalk';
import { httpGet } from '../utils/api-client.js';
import { findProjectRoot, getProjectPaths, parseEnvFile } from '../utils/project.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * 健康检查项
 */
interface HealthCheckItem {
  /** 检查项名称 */
  name: string;
  /** 检查状态 */
  status: 'ok' | 'error' | 'warn';
  /** 状态描述 */
  message: string;
}

/**
 * 检查服务健康状态
 * @param baseUrl 服务地址
 * @returns {Promise<HealthCheckItem>} 检查结果
 */
async function checkService(baseUrl: string): Promise<HealthCheckItem> {
  try {
    const res = await httpGet(`${baseUrl}/api/version`, {});
    if (res && res.data) {
      const version = (res.data as Record<string, unknown>).version || 'unknown';
      return { name: '服务', status: 'ok', message: `运行中 (v${version})` };
    }
    return { name: '服务', status: 'ok', message: '运行中' };
  } catch {
    return { name: '服务', status: 'error', message: `无法连接 ${baseUrl}` };
  }
}

/**
 * 检查 MySQL 连接
 * @param envVars 环境变量
 * @returns {HealthCheckItem} 检查结果
 */
function checkMysql(envVars: Record<string, string>): HealthCheckItem {
  const databaseUrl = envVars['DATABASE_URL'];
  if (!databaseUrl) {
    return { name: 'MySQL', status: 'error', message: 'DATABASE_URL 未配置' };
  }

  if (databaseUrl.startsWith('file:')) {
    return { name: '数据库', status: 'ok', message: `SQLite (${databaseUrl})` };
  }

  if (databaseUrl.includes('mysql')) {
    const match = databaseUrl.match(/mysql:\/\/([^@]+)@([^/]+)\/([^?]+)/);
    if (match) {
      return { name: 'MySQL', status: 'ok', message: `已配置 (${match[2]}/${match[3]})` };
    }
  }

  return { name: '数据库', status: 'warn', message: `已配置 (${databaseUrl.slice(0, 30)}...)` };
}

/**
 * 检查 Redis 连接
 * @param envVars 环境变量
 * @returns {HealthCheckItem} 检查结果
 */
function checkRedis(envVars: Record<string, string>): HealthCheckItem {
  const redisUrl = envVars['REDIS_URL'];
  if (!redisUrl) {
    return { name: 'Redis', status: 'warn', message: 'REDIS_URL 未配置（限流将使用内存存储）' };
  }
  return { name: 'Redis', status: 'ok', message: `已配置 (${redisUrl})` };
}

/**
 * 检查 Qdrant 向量数据库
 * @param envVars 环境变量
 * @returns {HealthCheckItem} 检查结果
 */
function checkQdrant(envVars: Record<string, string>): HealthCheckItem {
  const qdrantUrl = envVars['QDRANT_URL'];
  if (!qdrantUrl) {
    return { name: 'Qdrant', status: 'warn', message: 'QDRANT_URL 未配置（知识库功能不可用）' };
  }
  return { name: 'Qdrant', status: 'ok', message: `已配置 (${qdrantUrl})` };
}

/**
 * 检查 JWT 密钥配置
 * @param envVars 环境变量
 * @returns {HealthCheckItem} 检查结果
 */
function checkJwtSecret(envVars: Record<string, string>): HealthCheckItem {
  const jwtSecret = envVars['JWT_SECRET'];
  if (!jwtSecret) {
    return { name: 'JWT', status: 'error', message: 'JWT_SECRET 未配置' };
  }
  if (jwtSecret.includes('change') || jwtSecret.includes('Change') || jwtSecret.includes('CHANGE')) {
    return { name: 'JWT', status: 'warn', message: 'JWT_SECRET 仍为默认值，请修改' };
  }
  return { name: 'JWT', status: 'ok', message: '已配置' };
}

/**
 * 检查 Prisma 状态
 * @param serviceDir service 目录路径
 * @returns {HealthCheckItem} 检查结果
 */
function checkPrisma(serviceDir: string): HealthCheckItem {
  const prismaSchema = join(serviceDir, 'prisma', 'schema.prisma');
  if (!existsSync(prismaSchema)) {
    return { name: 'Prisma', status: 'error', message: 'schema.prisma 不存在' };
  }

  const prismaClient = join(serviceDir, 'node_modules', '.prisma', 'client');
  if (!existsSync(prismaClient)) {
    return { name: 'Prisma', status: 'warn', message: 'Prisma Client 未生成，请运行 npm run db:generate' };
  }

  return { name: 'Prisma', status: 'ok', message: '就绪' };
}

/**
 * 注册 health 命令
 * @returns {Command} Commander 命令实例
 */
export function createHealthCommand(): Command {
  return new Command('health')
    .description('检查服务健康状态')
    .option('-u, --url <url>', '服务地址', 'http://localhost:3002')
    .action(async (options: { url: string }) => {
      const { rootDir, found } = findProjectRoot();
      const baseUrl = options.url.replace(/\/$/, '');

      console.log(chalk.cyan('MuuAgent 健康检查\n'));
      console.log(chalk.gray('──────────────────────────────\n'));

      const checks: HealthCheckItem[] = [];

      /** 检查服务运行状态 */
      checks.push(await checkService(baseUrl));

      /** 检查配置文件 */
      if (found) {
        const paths = getProjectPaths(rootDir);
        const envPath = join(paths.service, '.env');
        const envVars = parseEnvFile(envPath);

        if (Object.keys(envVars).length === 0) {
          checks.push({
            name: '配置文件',
            status: 'error',
            message: '.env 文件不存在或为空，请复制 .env.example 并配置',
          });
        } else {
          checks.push(checkMysql(envVars));
          checks.push(checkRedis(envVars));
          checks.push(checkQdrant(envVars));
          checks.push(checkJwtSecret(envVars));
          checks.push(checkPrisma(paths.service));
        }
      } else {
        checks.push({
          name: '项目',
          status: 'warn',
          message: '未找到项目根目录，跳过配置检查',
        });
      }

      /** 输出检查结果 */
      let errorCount = 0;
      let warnCount = 0;

      for (const check of checks) {
        let icon: string;
        let color: (text: string) => string;

        switch (check.status) {
          case 'ok':
            icon = '✓';
            color = chalk.green;
            break;
          case 'error':
            icon = '✗';
            color = chalk.red;
            errorCount++;
            break;
          case 'warn':
            icon = '⚠';
            color = chalk.yellow;
            warnCount++;
            break;
        }

        console.log(`  ${color(icon)} ${chalk.bold(check.name)}: ${color(check.message)}`);
      }

      console.log(chalk.gray('\n──────────────────────────────'));
      console.log(`  总计: ${checks.length} 项 | ${chalk.green(`通过: ${checks.length - errorCount - warnCount}`)} | ${chalk.yellow(`警告: ${warnCount}`)} | ${chalk.red(`错误: ${errorCount}`)}`);

      if (errorCount > 0) {
        process.exit(1);
      }
    });
}
