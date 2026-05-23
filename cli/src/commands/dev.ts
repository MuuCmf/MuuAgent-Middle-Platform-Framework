import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn, ChildProcess } from 'child_process';
import { findProjectRoot, getProjectPaths } from '../utils/project.js';

/**
 * 子进程管理器
 * 跟踪所有启动的子进程，确保退出时正确清理
 */
const childProcesses: ChildProcess[] = [];

/**
 * 注册退出处理，确保所有子进程被清理
 */
function setupExitHandlers(): void {
  const cleanup = () => {
    for (const child of childProcesses) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => {
    for (const child of childProcesses) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
  });
}

/**
 * 启动子进程
 * @param command 命令
 * @param cwd 工作目录
 * @param label 日志标签
 * @param color 标签颜色
 * @returns {ChildProcess} 子进程实例
 */
function startProcess(
  command: string,
  cwd: string,
  label: string,
  color: (text: string) => string,
): ChildProcess {
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'cmd.exe' : '/bin/sh';
  const shellArgs = isWindows ? ['/c', command] : ['-c', command];

  const child = spawn(shell, shellArgs, {
    cwd,
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  const prefix = color(`[${label}]`);

  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`${prefix} ${line}`);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.error(`${prefix} ${line}`);
    }
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`${prefix} ${chalk.red(`进程退出，代码: ${code}`)}`);
    }
  });

  childProcesses.push(child);
  return child;
}

/**
 * 检查目录是否存在且包含 package.json
 * @param dirPath 目录路径
 * @param name 目录名称
 * @returns {boolean} 是否有效
 */
function validateDir(dirPath: string, name: string): boolean {
  const { existsSync } = require('fs');
  const { join } = require('path');

  if (!existsSync(dirPath)) {
    console.warn(chalk.yellow(`⚠ 目录不存在: ${name} (${dirPath})，已跳过`));
    return false;
  }

  if (!existsSync(join(dirPath, 'package.json'))) {
    console.warn(chalk.yellow(`⚠ 未找到 package.json: ${name} (${dirPath})，已跳过`));
    return false;
  }

  return true;
}

/**
 * 注册 dev 命令
 * @returns {Command} Commander 命令实例
 */
export function createDevCommand(): Command {
  return new Command('dev')
    .description('一键启动开发环境')
    .option('--only <targets>', '仅启动指定服务（逗号分隔: service,admin,client）')
    .option('--skip-install', '跳过依赖安装检查')
    .action(async (options: { only?: string; skipInstall?: boolean }) => {
      const { rootDir, found } = findProjectRoot();
      if (!found) {
        console.error(chalk.red('未找到 MuuAgent 项目根目录（缺少 VERSION 文件）'));
        process.exit(1);
      }

      const paths = getProjectPaths(rootDir);
      const spinner = ora('正在准备开发环境...').start();

      /** 解析要启动的目标 */
      const allTargets = ['service', 'admin', 'client'] as const;
      const targets = options.only
        ? options.only.split(',').map((t: string) => t.trim()).filter((t: string) => allTargets.includes(t as any))
        : [...allTargets];

      if (targets.length === 0) {
        spinner.fail('没有有效的启动目标');
        process.exit(1);
      }

      /** 检查依赖安装 */
      if (!options.skipInstall) {
        const { existsSync } = await import('fs');
        for (const target of targets) {
          const nodeModulesPath = require('path').join(paths[target], 'node_modules');
          if (!existsSync(nodeModulesPath)) {
            spinner.text = `正在安装 ${target} 依赖...`;
            const installCommand = 'npm install';
            await new Promise<void>((resolve, reject) => {
              const child = startProcess(installCommand, paths[target], `install:${target}`, chalk.gray);
              child.on('exit', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`${target} 依赖安装失败`));
              });
            });
          }
        }
      }

      spinner.succeed(`开发环境准备完成，正在启动: ${targets.join(', ')}`);

      setupExitHandlers();

      /** 启动各服务 */
      const startupDelay = 3000;

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const dirPath = paths[target];

        if (!validateDir(dirPath, target)) {
          continue;
        }

        let command = '';
        let label = '';
        let color: (text: string) => string = chalk.gray;

        switch (target) {
          case 'service':
            command = 'npm run start:dev';
            label = 'service';
            color = chalk.green;
            break;
          case 'admin':
            command = 'npm run dev';
            label = 'admin';
            color = chalk.blue;
            break;
          case 'client':
            command = 'npm run dev';
            label = 'client';
            color = chalk.magenta;
            break;
        }

        console.log(chalk.cyan(`🚀 启动 ${target}...`));
        startProcess(command, dirPath, label, color);

        /** 非最后一个目标时，等待一段时间再启动下一个 */
        if (i < targets.length - 1 && target === 'service') {
          console.log(chalk.gray(`  等待 ${startupDelay / 1000}s 后启动下一个服务...`));
          await new Promise((r) => setTimeout(r, startupDelay));
        }
      }

      console.log(chalk.green('\n✓ 所有服务已启动'));
      console.log(chalk.gray('  按 Ctrl+C 停止所有服务\n'));
    });
}
