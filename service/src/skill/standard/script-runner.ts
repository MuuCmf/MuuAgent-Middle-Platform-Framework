import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { SandboxExecutor } from '../executors/sandbox.executor';

/**
 * 脚本执行结果
 */
export interface ScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  truncated: boolean;
}

/**
 * 脚本执行选项
 */
export interface ScriptRunOptions {
  timeout?: number;          // 超时时间（ms），默认 30000
  maxOutput?: number;        // 最大输出长度（字节），默认 102400
  env?: Record<string, string>;
}

const DEFAULT_OPTIONS: Required<ScriptRunOptions> = {
  timeout: 30000,
  maxOutput: 102400, // 100KB
  env: {},
};

/**
 * 跨语言脚本执行器
 *
 * 根据文件扩展名选择运行时：
 *   .js  → VM2 沙箱（复用 SandboxExecutor）
 *   .py  → child_process.spawn('python3')
 *   .sh  → child_process.spawn('bash')
 */
@Injectable()
export class ScriptRunner {
  private readonly logger = new Logger(ScriptRunner.name);

  // 允许的脚本扩展名
  private readonly allowedExtensions = new Set(['.js', '.py', '.sh']);

  constructor(private readonly sandboxExecutor: SandboxExecutor) {}

  /**
   * 执行技能目录中的脚本
   *
   * @param skillDir 技能目录绝对路径
   * @param scriptPath 相对于技能目录的脚本路径
   * @param args 传递给脚本的参数
   * @param options 执行选项
   */
  async run(
    skillDir: string,
    scriptPath: string,
    args: Record<string, string>,
    options?: ScriptRunOptions,
  ): Promise<ScriptResult> {
    // 安全检查：防目录穿越
    this.validatePath(skillDir, scriptPath);

    const fullPath = path.resolve(skillDir, scriptPath);
    const ext = path.extname(fullPath).toLowerCase();

    if (!this.allowedExtensions.has(ext)) {
      throw new Error(`不支持的脚本类型: ${ext}。仅允许: ${[...this.allowedExtensions].join(', ')}`);
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (ext === '.js') {
      return this.runJavaScript(fullPath, args, opts);
    }

    // Python / Bash 使用子进程执行
    const runtime = ext === '.py' ? 'python3' : 'bash';
    return this.runWithChildProcess(runtime, fullPath, args, opts);
  }

  /**
   * 路径安全检查
   * 确保脚本路径在技能目录内，防止目录穿越攻击
   */
  private validatePath(skillDir: string, scriptPath: string): void {
    const normalizedDir = path.resolve(skillDir);
    const fullPath = path.resolve(normalizedDir, scriptPath);

    if (!fullPath.startsWith(normalizedDir)) {
      throw new Error(`不允许访问技能目录外的文件: ${scriptPath}`);
    }

    if (scriptPath.includes('..')) {
      throw new Error(`脚本路径不能包含 ".." : ${scriptPath}`);
    }
  }

  /**
   * 使用 VM2 沙箱执行 JavaScript
   */
  private async runJavaScript(
    filePath: string,
    args: Record<string, string>,
    options: Required<ScriptRunOptions>,
  ): Promise<ScriptResult> {
    const startTime = Date.now();

    try {
      const code = fs.readFileSync(filePath, 'utf-8');

      const result = await this.sandboxExecutor.execute(code, args, options.timeout);

      return {
        stdout: result.success ? JSON.stringify(result.data) : '',
        stderr: result.error || '',
        exitCode: result.success ? 0 : 1,
        duration: result.duration || (Date.now() - startTime),
        truncated: false,
      };
    } catch (err) {
      return {
        stdout: '',
        stderr: `JS 脚本执行异常: ${(err as Error).message}`,
        exitCode: 1,
        duration: Date.now() - startTime,
        truncated: false,
      };
    }
  }

  /**
   * 使用子进程执行 Python / Bash 脚本
   */
  private async runWithChildProcess(
    runtime: string,
    filePath: string,
    args: Record<string, string>,
    options: Required<ScriptRunOptions>,
  ): Promise<ScriptResult> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let truncated = false;
      let killed = false;

      const env = { ...process.env, ...options.env };
      // 限制子进程能力
      env.PATH = '/usr/local/bin:/usr/bin:/bin';

      const child = spawn(runtime, [filePath], {
        env,
        cwd: path.dirname(filePath),
        timeout: options.timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // 通过 stdin 传递 JSON 参数
      const argsJson = JSON.stringify(args);
      child.stdin.write(argsJson);
      child.stdin.end();

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 3000);
      }, options.timeout);

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        if (stdout.length < options.maxOutput) {
          stdout += text;
          if (stdout.length > options.maxOutput) {
            stdout = stdout.slice(0, options.maxOutput);
            truncated = true;
          }
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        if (stderr.length < options.maxOutput) {
          stderr += text;
          if (stderr.length > options.maxOutput) {
            stderr = stderr.slice(0, options.maxOutput);
          }
        }
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? (killed ? 124 : 1),
          duration: Date.now() - startTime,
          truncated,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          stdout: '',
          stderr: `进程启动失败: ${err.message}`,
          exitCode: 1,
          duration: Date.now() - startTime,
          truncated: false,
        });
      });
    });
  }
}
