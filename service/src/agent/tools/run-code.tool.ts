import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { SandboxExecutor } from '../../skill/executors/sandbox.executor';
import { ScriptRunner, ScriptResult } from '../../skill/standard/script-runner';
import { FunctionToolDefinition } from './tool-definitions';

/**
 * 代码执行结果
 */
export interface RunCodeResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  language: string;
}

/**
 * 通用代码执行工具
 *
 * 取代所有 FUNCTION 类型的 DB 技能。支持 JS（VM2 沙箱）、Python 和 Bash。
 * JS 执行复用 SandboxExecutor，Python/Bash 通过 ScriptRunner 子进程执行。
 */
@Injectable()
export class RunCodeTool {
  private readonly logger = new Logger(RunCodeTool.name);

  constructor(
    private readonly sandboxExecutor: SandboxExecutor,
    private readonly scriptRunner: ScriptRunner,
  ) {}

  static readonly definition: FunctionToolDefinition = {
    type: 'function',
    function: {
      name: 'run_code',
      description: `在安全沙箱中执行代码。支持 JavaScript（VM2 沙箱）、Python 和 Bash。
使用前请确保已通过 use_skill 加载相关技能指令。
JS 可直接使用 params 变量访问参数；Python/Bash 通过 stdin JSON 接收参数。
代码执行有超时限制，禁止网络和文件系统访问。`,
      parameters: {
        type: 'object',
        properties: {
          language: {
            type: 'string',
            enum: ['javascript', 'python', 'bash'],
            description: '代码语言',
          },
          code: {
            type: 'string',
            description: '要执行的代码。JS 中通过 params 全局变量访问参数',
          },
          params: {
            type: 'object',
            description: '传递给代码的参数。JS 中通过 params 变量访问；Python/Bash 通过 stdin JSON 接收',
          },
          timeout: {
            type: 'number',
            description: '超时（毫秒），JS 默认 5000，Python/Bash 默认 30000',
          },
        },
        required: ['language', 'code'],
      },
    },
  };

  async execute(args: {
    language: string;
    code: string;
    params?: Record<string, unknown>;
    timeout?: number;
  }): Promise<RunCodeResult> {
    switch (args.language) {
      case 'javascript':
        return this.executeJavaScript(args.code, args.params || {}, args.timeout);
      case 'python':
      case 'bash':
        return this.executeWithScriptRunner(args.language, args.code, args.params || {}, args.timeout);
      default:
        throw new HttpException(`不支持的语言: ${args.language}`, HttpStatus.BAD_REQUEST);
    }
  }

  private async executeJavaScript(
    code: string,
    params: Record<string, unknown>,
    timeout?: number,
  ): Promise<RunCodeResult> {
    const result = await this.sandboxExecutor.execute(code, params, timeout || 5000);
    return {
      success: result.success,
      data: result.data,
      error: result.error,
      duration: result.duration || 0,
      language: 'javascript',
    };
  }

  private async executeWithScriptRunner(
    language: string,
    code: string,
    params: Record<string, unknown>,
    timeout?: number,
  ): Promise<RunCodeResult> {
    const tmpDir = path.join(process.cwd(), 'skills', '.tmp');
    await fs.mkdir(tmpDir, { recursive: true });

    const ext = language === 'python' ? '.py' : '.sh';
    const tmpFileName = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const tmpFilePath = path.join(tmpDir, tmpFileName);

    try {
      await fs.writeFile(tmpFilePath, code);

      const stringArgs: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        stringArgs[k] = typeof v === 'string' ? v : JSON.stringify(v);
      }

      const result: ScriptResult = await this.scriptRunner.run(
        tmpDir,
        tmpFileName,
        stringArgs,
        { timeout: timeout || 30000 },
      );

      return {
        success: result.exitCode === 0,
        data: { stdout: result.stdout, stderr: result.stderr },
        error: result.exitCode !== 0 ? result.stderr || `exit code: ${result.exitCode}` : undefined,
        duration: result.duration,
        language,
      };
    } catch (err) {
      return {
        success: false,
        error: `代码执行异常: ${(err as Error).message}`,
        duration: 0,
        language,
      };
    } finally {
      await fs.unlink(tmpFilePath).catch(() => {});
    }
  }
}
