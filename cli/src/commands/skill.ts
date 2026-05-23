import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { findProjectRoot, getProjectPaths } from '../utils/project.js';

/**
 * Skill frontmatter 字段定义
 * 对齐 Agent Skills Open Specification V1.0
 */
interface SkillFrontmatter {
  /** 技能唯一标识 */
  name: string;
  /** 语义版本号 */
  version?: string;
  /** 技能描述 */
  description: string;
  /** 许可协议 */
  license?: string;
  /** 环境兼容性 */
  compatibility?: string;
  /** 元数据 */
  metadata?: Record<string, string>;
  /** 预授权工具列表 */
  'allowed-tools'?: string;
  /** 依赖声明 */
  requires?: {
    mcpServers?: string[];
    knowledgeBases?: string[];
    tools?: string[];
    skills?: string[];
    workspace?: boolean;
  };
}

/**
 * 校验错误
 */
interface ValidationError {
  field: string;
  message: string;
  code: 'MISSING_REQUIRED' | 'FORMAT_INVALID' | 'LENGTH_EXCEEDED' | 'NAME_MISMATCH';
}

/**
 * 校验结果
 */
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * SKILL.md 模板
 * @param name 技能名称
 * @param description 技能描述
 * @param type 技能类型
 * @returns {string} SKILL.md 内容
 */
function generateSkillTemplate(name: string, description: string, type: string): string {
  const requiresSection = type === 'script'
    ? `requires:\n  workspace: false`
    : type === 'workspace'
    ? `requires:\n  workspace: true`
    : '';

  const allowedTools = type === 'script' ? 'javascript' : '';

  return `---
name: ${name}
description: ${description}
license: MIT
metadata:
  author: muu-agent
  version: "1.0.0"
  tags: []
${allowedTools ? `allowed-tools: "${allowedTools}"\n` : ''}${requiresSection ? requiresSection + '\n' : ''}---

# ${name}

${description}

## 使用说明

在此编写技能说明。

## 参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| input  | string | 是 | 输入参数 |

## 示例

\`\`\`json
{
  "input": "示例输入"
}
\`\`\`
`;
}

/**
 * 脚本入口模板
 * @param name 技能名称
 * @returns {string} 脚本内容
 */
function generateScriptTemplate(name: string): string {
  return `/**
 * ${name} 技能脚本
 * @param {object} params - 输入参数
 * @param {string} params.input - 输入内容
 * @returns {object} 处理结果
 */
module.exports = async (params) => {
  const { input } = params;

  return {
    result: input,
    message: "${name} 处理完成",
  };
};
`;
}

/**
 * 解析 SKILL.md 文件
 * @param filePath SKILL.md 文件路径
 * @returns {{ frontmatter: SkillFrontmatter; body: string; rawYaml: string }} 解析结果
 */
function parseSkillMd(filePath: string): { frontmatter: SkillFrontmatter; body: string; rawYaml: string } {
  const content = fsSync.readFileSync(filePath, 'utf-8');
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error(`SKILL.md 格式错误：未找到有效的 YAML frontmatter (${filePath})`);
  }

  const rawYaml = match[1];
  const body = match[2].trim();
  const frontmatter = yaml.load(rawYaml) as SkillFrontmatter;

  return { frontmatter, body, rawYaml };
}

/**
 * 校验 SKILL.md frontmatter
 * 对齐 Agent Skills Open Specification V1.0 校验规则
 * @param frontmatter frontmatter 数据
 * @param directoryPath 目录路径
 * @returns {ValidationResult} 校验结果
 */
function validateFrontmatter(frontmatter: SkillFrontmatter, directoryPath: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  /** 校验 name */
  if (!frontmatter.name) {
    errors.push({ field: 'name', message: 'name 字段为必填项', code: 'MISSING_REQUIRED' });
  } else {
    if (frontmatter.name.length > 64) {
      errors.push({ field: 'name', message: `name 长度不能超过 64 个字符（当前 ${frontmatter.name.length} 字符）`, code: 'LENGTH_EXCEEDED' });
    }
    if (!namePattern.test(frontmatter.name)) {
      errors.push({ field: 'name', message: 'name 只能包含小写字母、数字和连字符', code: 'FORMAT_INVALID' });
    }
    const dirName = directoryPath.split(/[/\\]/).pop() || '';
    if (dirName && frontmatter.name !== dirName) {
      errors.push({ field: 'name', message: `name "${frontmatter.name}" 与目录名 "${dirName}" 不一致`, code: 'NAME_MISMATCH' });
    }
  }

  /** 校验 description */
  if (!frontmatter.description) {
    errors.push({ field: 'description', message: 'description 字段为必填项', code: 'MISSING_REQUIRED' });
  } else if (frontmatter.description.length > 1024) {
    errors.push({ field: 'description', message: `description 长度不能超过 1024 个字符（当前 ${frontmatter.description.length} 字符）`, code: 'LENGTH_EXCEEDED' });
  }

  /** 校验 license（仅警告） */
  if (!frontmatter.license) {
    warnings.push('建议填写 license 字段，明确技能的许可协议');
  }

  /** 校验 version（仅警告） */
  if (!frontmatter.version && !frontmatter.metadata?.version) {
    warnings.push('建议填写 version 字段');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 递归扫描所有 SKILL.md 文件
 * @param rootDir 根目录
 * @returns {string[]} SKILL.md 文件路径列表
 */
function scanSkillFiles(rootDir: string): string[] {
  const results: string[] = [];

  if (!fsSync.existsSync(rootDir)) {
    return results;
  }

  function walk(dir: string): void {
    const entries = fsSync.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'SKILL.md') {
        results.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return results;
}

/**
 * 注册 skill 命令组
 * @returns {Command} Commander 命令实例
 */
export function createSkillCommand(): Command {
  const skill = new Command('skill')
    .description('技能管理工具');

  /** skill create */
  skill
    .command('create <name>')
    .description('创建新技能（交互式）')
    .option('-d, --description <desc>', '技能描述')
    .option('-t, --type <type>', '技能类型 (script|http|workspace)', 'script')
    .option('-p, --public', '创建为公共技能（_public 目录下）', false)
    .action(async (name: string, options: {
      description?: string;
      type: string;
      public: boolean;
    }) => {
      const { rootDir, found } = findProjectRoot();
      if (!found) {
        console.error(chalk.red('未找到 MuuAgent 项目根目录'));
        process.exit(1);
      }

      const paths = getProjectPaths(rootDir);

      /** 校验名称格式 */
      const namePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      if (!namePattern.test(name)) {
        console.error(chalk.red('技能名称只能包含小写字母、数字和连字符'));
        process.exit(1);
      }

      /** 交互式收集信息 */
      let description: string = options.description || '';
      let type: string = options.type;

      if (!description) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: '技能描述:',
            validate: (input: string) => input.trim() ? true : '描述不能为空',
          },
        ]);
        description = answers.description;
      }

      if (!options.type) {
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'type',
            message: '技能类型:',
            choices: [
              { name: 'script - 脚本执行', value: 'script' },
              { name: 'http - HTTP 请求', value: 'http' },
              { name: 'workspace - 工作目录操作', value: 'workspace' },
            ],
          },
        ]);
        type = answers.type;
      }

      /** 确定目标目录 */
      const skillBaseDir = options.public
        ? path.join(paths.skills, '_public')
        : paths.skills;
      const skillDir = path.join(skillBaseDir, name);

      /** 检查是否已存在 */
      if (fsSync.existsSync(skillDir)) {
        console.error(chalk.red(`技能目录已存在: ${skillDir}`));
        process.exit(1);
      }

      /** 创建目录和文件 */
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        generateSkillTemplate(name, description, type),
      );

      /** script 类型创建脚本模板 */
      if (type === 'script') {
        const scriptsDir = path.join(skillDir, 'scripts');
        await fs.mkdir(scriptsDir, { recursive: true });
        await fs.writeFile(
          path.join(scriptsDir, 'index.js'),
          generateScriptTemplate(name),
        );
      }

      console.log(chalk.green(`✓ 技能 ${name} 创建成功`));
      console.log(chalk.gray(`  目录: ${skillDir}`));
      if (type === 'script') {
        console.log(chalk.gray(`  脚本: ${path.join(skillDir, 'scripts', 'index.js')}`));
      }
      console.log(chalk.gray(`\n  编辑 SKILL.md 完善技能描述和参数定义`));
    });

  /** skill validate */
  skill
    .command('validate')
    .description('校验所有 SKILL.md 文件格式')
    .option('-p, --path <dir>', '指定技能目录（默认扫描全部）')
    .action(async (options: { path?: string }) => {
      const { rootDir, found } = findProjectRoot();
      if (!found) {
        console.error(chalk.red('未找到 MuuAgent 项目根目录'));
        process.exit(1);
      }

      const paths = getProjectPaths(rootDir);
      const scanDir = options.path || paths.skills;

      console.log(chalk.cyan(`扫描目录: ${scanDir}\n`));

      const skillFiles = scanSkillFiles(scanDir);

      if (skillFiles.length === 0) {
        console.log(chalk.yellow('未找到任何 SKILL.md 文件'));
        return;
      }

      let totalErrors = 0;
      let totalWarnings = 0;
      let validCount = 0;

      for (const filePath of skillFiles) {
        const relativePath = path.relative(rootDir, filePath);

        try {
          const { frontmatter, body } = parseSkillMd(filePath);
          const dirPath = path.dirname(filePath);
          const result = validateFrontmatter(frontmatter, dirPath);

          if (result.valid) {
            validCount++;
            console.log(chalk.green(`  ✓ ${relativePath}`));
          } else {
            console.log(chalk.red(`  ✗ ${relativePath}`));
            for (const err of result.errors) {
              console.log(chalk.red(`    - [${err.code}] ${err.field}: ${err.message}`));
              totalErrors++;
            }
          }

          for (const warn of result.warnings) {
            console.log(chalk.yellow(`    ⚠ ${warn}`));
            totalWarnings++;
          }
        } catch (err) {
          console.log(chalk.red(`  ✗ ${relativePath}: ${(err as Error).message}`));
          totalErrors++;
        }
      }

      console.log(chalk.cyan(`\n──────────────────────────────`));
      console.log(`  总计: ${skillFiles.length} 个技能`);
      console.log(`  通过: ${chalk.green(String(validCount))}`);
      console.log(`  错误: ${chalk.red(String(totalErrors))}`);
      console.log(`  警告: ${chalk.yellow(String(totalWarnings))}`);

      if (totalErrors > 0) {
        process.exit(1);
      }
    });

  /** skill list */
  skill
    .command('list')
    .description('列出所有技能')
    .option('-p, --path <dir>', '指定技能目录')
    .action(async (options: { path?: string }) => {
      const { rootDir, found } = findProjectRoot();
      if (!found) {
        console.error(chalk.red('未找到 MuuAgent 项目根目录'));
        process.exit(1);
      }

      const paths = getProjectPaths(rootDir);
      const scanDir = options.path || paths.skills;
      const skillFiles = scanSkillFiles(scanDir);

      if (skillFiles.length === 0) {
        console.log(chalk.yellow('未找到任何技能'));
        return;
      }

      console.log(chalk.cyan(`找到 ${skillFiles.length} 个技能:\n`));

      for (const filePath of skillFiles) {
        try {
          const { frontmatter } = parseSkillMd(filePath);
          const relativePath = path.relative(rootDir, path.dirname(filePath));
          const version = frontmatter.version || frontmatter.metadata?.version || '-';
          console.log(`  ${chalk.green(frontmatter.name)} ${chalk.gray(`v${version}`)}`);
          console.log(`    ${chalk.gray(frontmatter.description)}`);
          console.log(`    ${chalk.gray(relativePath)}`);
          console.log();
        } catch {
          const relativePath = path.relative(rootDir, filePath);
          console.log(`  ${chalk.red('解析失败')} ${chalk.gray(relativePath)}`);
          console.log();
        }
      }
    });

  /** skill test */
  skill
    .command('test <name>')
    .description('本地测试技能脚本')
    .option('-i, --input <json>', '输入参数（JSON 格式）', '{}')
    .option('-p, --path <dir>', '指定技能目录')
    .action(async (name: string, options: { input: string; path?: string }) => {
      const { rootDir, found } = findProjectRoot();
      if (!found) {
        console.error(chalk.red('未找到 MuuAgent 项目根目录'));
        process.exit(1);
      }

      const paths = getProjectPaths(rootDir);
      const scanDir = options.path || paths.skills;

      /** 查找技能目录 */
      const skillFiles = scanSkillFiles(scanDir);
      const targetFile = skillFiles.find((f) => {
        const dirName = path.dirname(f).split(/[/\\]/).pop();
        return dirName === name;
      });

      if (!targetFile) {
        console.error(chalk.red(`未找到技能: ${name}`));
        process.exit(1);
      }

      const skillDir = path.dirname(targetFile);
      const scriptPath = path.join(skillDir, 'scripts', 'index.js');

      if (!fsSync.existsSync(scriptPath)) {
        console.error(chalk.red(`技能 ${name} 没有可执行的脚本文件`));
        console.log(chalk.gray(`  期望路径: ${scriptPath}`));
        process.exit(1);
      }

      /** 解析输入参数 */
      let params: Record<string, unknown>;
      try {
        params = JSON.parse(options.input);
      } catch {
        console.error(chalk.red('输入参数不是有效的 JSON'));
        process.exit(1);
      }

      console.log(chalk.cyan(`测试技能: ${name}`));
      console.log(chalk.gray(`  脚本: ${scriptPath}`));
      console.log(chalk.gray(`  输入: ${JSON.stringify(params)}\n`));

      /** 执行脚本 */
      try {
        const scriptModule = await import(`file://${scriptPath.replace(/\\/g, '/')}`);
        const handler = scriptModule.default || scriptModule;
        if (typeof handler !== 'function') {
          console.error(chalk.red('脚本未导出函数'));
          process.exit(1);
        }

        const result = await handler(params);
        console.log(chalk.green('✓ 执行成功'));
        console.log(chalk.cyan('结果:'));
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        console.error(chalk.red(`✗ 执行失败: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  return skill;
}
