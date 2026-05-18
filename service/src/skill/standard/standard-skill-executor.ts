import { Injectable, Logger } from '@nestjs/common';
import { SkillRegistry, SkillDescriptor } from '../skill-registry';
import { ScriptRunner, ScriptResult } from './script-runner';
import { IsolationContext } from '../../common/utils/isolation.util';

/**
 * 标准技能执行结果
 */
export interface StandardSkillResult {
  skillName: string;
  source: 'filesystem';
  instructions: string;
  scriptResult?: ScriptResult;
  referencesUsed: string[];
  executionType?: string;
}

/**
 * 标准技能执行选项
 */
export interface StandardSkillExecuteOptions {
  scriptPath?: string;
  scriptArgs?: Record<string, string>;
  scriptTimeout?: number;
}

/**
 * 标准技能执行器
 *
 * 统一处理文件系统标准技能的执行：
 * 加载 SKILL.md 指令 + 可选执行 scripts/
 */
@Injectable()
export class StandardSkillExecutor {
  private readonly logger = new Logger(StandardSkillExecutor.name);

  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly scriptRunner: ScriptRunner,
  ) {}

  /**
   * 加载技能指令（L1 → L2）
   */
  async loadInstructions(
    skillName: string,
    context?: IsolationContext,
  ): Promise<SkillDescriptor | null> {
    const descriptor = await this.skillRegistry.resolve(skillName, context);
    if (!descriptor) {
      this.logger.warn(`技能 "${skillName}" 不存在`);
      return null;
    }
    this.logger.log(`加载技能 "${skillName}" 指令`);
    return descriptor;
  }

  /**
   * 执行技能（加载指令 + 可选脚本执行）
   */
  async execute(
    skillName: string,
    context?: IsolationContext,
    options?: StandardSkillExecuteOptions,
  ): Promise<StandardSkillResult> {
    const descriptor = await this.skillRegistry.resolve(skillName, context);
    if (!descriptor) {
      throw new Error(`技能 "${skillName}" 不存在或不可用`);
    }

    const result: StandardSkillResult = {
      skillName,
      source: descriptor.metadata.source,
      instructions: descriptor.instructions,
      referencesUsed: [],
    };

    if (options?.scriptPath) {
      const entry = await this.skillRegistry.findByName(skillName, context);
      if (!entry) {
        throw new Error(`技能 "${skillName}" 不在索引中`);
      }

      const scannerEntry = this.skillRegistry.getScannerEntry(skillName);
      const skillDir = scannerEntry?.directoryPath || '';

      if (!skillDir) {
        throw new Error(`无法确定技能 "${skillName}" 的目录路径`);
      }

      if (descriptor.allowedTools && !descriptor.allowedTools.includes('bash') && !descriptor.allowedTools.includes('python')) {
        throw new Error(`技能 "${skillName}" 未授权脚本执行（allowed-tools: ${descriptor.allowedTools?.join(', ') || '无'}）`);
      }

      try {
        result.scriptResult = await this.scriptRunner.run(
          skillDir,
          options.scriptPath,
          options.scriptArgs || {},
          { timeout: options.scriptTimeout },
        );
      } catch (err) {
        this.logger.error(`脚本执行失败: ${(err as Error).message}`);
        throw err;
      }
    }

    return result;
  }

  /**
   * 仅执行脚本（不重新加载指令）
   */
  async executeScript(
    skillDir: string,
    scriptPath: string,
    args: Record<string, string>,
    timeout?: number,
  ): Promise<ScriptResult> {
    return this.scriptRunner.run(skillDir, scriptPath, args, { timeout });
  }
}
