#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { findProjectRoot, readVersion } from './utils/project.js';
import { createDevCommand } from './commands/dev.js';
import { createChatCommand } from './commands/chat.js';
import { createSkillCommand } from './commands/skill.js';
import { createHealthCommand } from './commands/health.js';
import { createConfigCommand } from './commands/config.js';

/**
 * MuuAgent CLI 入口
 * 企业级AI中台命令行工具
 */
async function main(): Promise<void> {
  const { rootDir } = findProjectRoot();
  const version = readVersion(rootDir);

  const program = new Command();

  program
    .name('muu')
    .description('MuuAgent CLI - 企业级AI中台命令行工具')
    .version(version, '-v, --version', '显示版本号')
    .helpOption('-h, --help', '显示帮助信息');

  /** 注册命令 */
  program.addCommand(createDevCommand());
  program.addCommand(createChatCommand());
  program.addCommand(createSkillCommand());
  program.addCommand(createHealthCommand());
  program.addCommand(createConfigCommand());

  /** 未知命令处理 */
  program.on('command:*', (operands) => {
    console.error(chalk.red(`未知命令: ${operands[0]}`));
    console.log(chalk.gray(`运行 muu --help 查看可用命令`));
    process.exit(1);
  });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(chalk.red(`致命错误: ${err.message}`));
  process.exit(1);
});
