import { Injectable, Logger } from '@nestjs/common';
import { SkillRegistry, SkillDescriptor } from '../skill-registry';
import { ScriptRunner, ScriptResult } from './script-runner';
import { IsolationContext } from '../../common/utils/isolation.util';

/**
 * 标准技能执行结果
 */
export interface StandardSkillResult {
  skillName: string;
  source: 'database' | 'filesystem';
  instructions: string;
  scriptResult?: ScriptResult;
  referencesUsed: string[];
  executionType?: string;
  dbSkillResult?: unknown;
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
 * 统一处理标准技能的执行：
 * - filesystem 来源：加载 SKILL.md 指令 + 可选执行 scripts/
 * - database 来源：委托给现有 SkillService 流水线 + 包装为标准格式
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
   * 不执行脚本，仅返回技能指令文本
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
    this.logger.log(`加载技能 "${skillName}" 指令 (${descriptor.metadata.source})`);
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

    // DB 技能：委托原有流水线
    if (descriptor.metadata.source === 'database' && descriptor.executionConfig) {
      result.executionType = descriptor.executionConfig.type;
      // 实际执行由现有的 skill__{code} 工具路由处理
      // 这里仅返回指令，执行发生在 ToolExecutor.executeSkill()
      return result;
    }

    // 文件系统技能：执行脚本（如果请求）
    if (options?.scriptPath) {
      // 检查 allowed-tools
      if (descriptor.allowedTools && !descriptor.allowedTools.includes('bash') && !descriptor.allowedTools.includes('python')) {
        throw new Error(`技能 "${skillName}" 未授权脚本执行（allowed-tools: ${descriptor.allowedTools?.join(', ') || '无'}）`);
      }

      // 查找技能目录
      const entry = await this.skillRegistry.findByName(skillName, context);
      if (!entry) {
        throw new Error(`技能 "${skillName}" 不在索引中`);
      }

      // 文件系统技能的目录信息需要通过 FileSkillProvider 获取
      // 这里委托给 SkillRegistry，由它路由到正确的 Provider
      try {
        result.scriptResult = await this.scriptRunner.run(
          '', // 由 SkillRegistry 内部的 FileSkillProvider 补全路径
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
   * 适用于已经加载了技能指令后的脚本调用
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
