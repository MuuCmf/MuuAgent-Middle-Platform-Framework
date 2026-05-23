import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';

/**
 * 项目根目录查找结果
 */
interface ProjectRoot {
  /** 项目根目录绝对路径 */
  rootDir: string;
  /** 是否找到有效项目 */
  found: boolean;
}

/**
 * 查找项目根目录
 * 从当前工作目录向上查找，直到找到包含 VERSION 文件的目录
 * @param startDir 起始查找目录
 * @returns {ProjectRoot} 项目根目录信息
 */
export function findProjectRoot(startDir: string = process.cwd()): ProjectRoot {
  let currentDir = resolve(startDir);

  for (let i = 0; i < 10; i++) {
    if (existsSync(join(currentDir, 'VERSION'))) {
      return { rootDir: currentDir, found: true };
    }

    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return { rootDir: process.cwd(), found: false };
}

/**
 * 获取项目各子目录的绝对路径
 * @param rootDir 项目根目录
 * @returns {Record<string, string>} 各子目录路径映射
 */
export function getProjectPaths(rootDir: string): Record<string, string> {
  return {
    service: join(rootDir, 'service'),
    admin: join(rootDir, 'admin'),
    client: join(rootDir, 'client'),
    desktop: join(rootDir, 'desktop'),
    cli: join(rootDir, 'cli'),
    deploy: join(rootDir, 'deploy'),
    skills: join(rootDir, 'service', 'skills', 'standard'),
    prisma: join(rootDir, 'service', 'prisma'),
  };
}

/**
 * 读取项目版本号
 * @param rootDir 项目根目录
 * @returns {string} 版本号
 */
export function readVersion(rootDir: string): string {
  const versionPath = join(rootDir, 'VERSION');
  if (existsSync(versionPath)) {
    return readFileSync(versionPath, 'utf-8').trim();
  }
  return '0.0.0';
}

/**
 * 解析 .env 文件为键值对
 * @param filePath .env 文件路径
 * @returns {Record<string, string>} 环境变量键值对
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, 'utf-8');
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}
