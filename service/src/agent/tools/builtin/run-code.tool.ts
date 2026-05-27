import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { BaseTool } from '../abstract/base-tool';
import { ToolDefinition, ToolExecutionContext } from '../abstract/tool.interface';
import { AgentTool } from '../decorators';
import { SandboxExecutor } from '../../../skill/executors/sandbox.executor';
import { ScriptRunner, ScriptResult } from '../../../skill/standard/script-runner';
import { buildSkillHint } from './tool-hint.constants';

export interface RunCodeResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  language: string;
}

/**
 * 代码执行工具
 * 在安全沙箱中执行 JavaScript、Python 和 Bash 代码
 */
@AgentTool({
  name: 'run_code',
  enabled: true,
  category: 'builtin',
})
export class RunCodeTool extends BaseTool {
  readonly name = 'run_code';

  readonly definition: ToolDefinition = {
    name: 'run_code',
    description: `在安全沙箱中执行代码。支持 JavaScript（VM2 沙箱）、Python 和 Bash。
${buildSkillHint()}
JS 可直接使用 params 变量访问参数；Python/Bash 通过 stdin JSON 接收参数。
代码执行有超时限制，禁止网络和文件系统访问。

**重要提示**：
- JavaScript 代码可以通过 return 语句返回结果，或使用 console.log 输出结果
- 返回值格式：{ result: 返回值, consoleOutput: [控制台输出数组] }
- 如果只需要输出信息，使用 console.log 即可，输出会被收集并返回`,
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['javascript', 'python', 'bash'],
          description: '代码语言',
        },
        code: { type: 'string', description: '要执行的代码。JS 中通过 params 全局变量访问参数' },
        params: {
          type: 'object',
          description: '传递给代码的参数。JS 中通过 params 变量访问；Python/Bash 通过 stdin JSON 接收',
        },
        timeout: { type: 'number', description: '超时（毫秒），JS 默认 5000，Python/Bash 默认 30000' },
      },
      required: ['language', 'code'],
    },
    type: 'builtin',
  };

  constructor(
    private readonly sandboxExecutor: SandboxExecutor,
    private readonly scriptRunner: ScriptRunner,
  ) {
    super();
  }

  async execute(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    const language = this.getArg<string>(args, 'language');
    const code = this.getArg<string>(args, 'code');
    const params = this.getArg<Record<string, unknown>>(args, 'params', {});
    const timeout = this.getArg<number>(args, 'timeout');

    switch (language) {
      case 'javascript':
        return this.executeJavaScript(code, params, timeout || 5000);
      case 'python':
      case 'bash':
        return this.executeWithScriptRunner(language, code, params, timeout || 30000);
      default:
        throw new Error(`不支持的语言: ${language}`);
    }
  }

  /**
   * 执行 JavaScript 代码
   * @param code 代码内容
   * @param params 参数
   * @param timeout 超时时间
   */
  private async executeJavaScript(
    code: string,
    params: Record<string, unknown>,
    timeout: number,
  ): Promise<RunCodeResult> {
    const result = await this.sandboxExecutor.execute(code, params, timeout);
    return {
      success: result.success,
      data: result.data,
      error: result.error,
      duration: result.duration || 0,
      language: 'javascript',
    };
  }

  /**
   * 使用 ScriptRunner 执行 Python/Bash 代码
   * @param language 语言
   * @param code 代码内容
   * @param params 参数
   * @param timeout 超时时间
   */
  private async executeWithScriptRunner(
    language: string,
    code: string,
    params: Record<string, unknown>,
    timeout: number,
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

      const result: ScriptResult = await this.scriptRunner.run(tmpDir, tmpFileName, stringArgs, {
        timeout,
      });

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
