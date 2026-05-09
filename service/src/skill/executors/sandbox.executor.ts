import { Injectable, Logger } from '@nestjs/common';
import { VM } from 'vm2';
import { FunctionResult } from '../interfaces/plugin.interface';

/**
 * 沙箱函数执行器
 */
@Injectable()
export class SandboxExecutor {
  private readonly logger = new Logger(SandboxExecutor.name);

  /**
   * 在沙箱中执行代码
   * @param code JavaScript 代码
   * @param params 参数
   * @param timeout 超时时间（毫秒）
   * @returns 执行结果
   */
  async execute(
    code: string,
    params: Record<string, unknown>,
    timeout: number = 5000,
  ): Promise<FunctionResult> {
    const startTime = Date.now();

    try {
      if (!this.validateCode(code)) {
        return {
          success: false,
          error: '代码包含不安全的内容',
        };
      }

      const vm = new VM({
        timeout,
        sandbox: {
          params,
          console: {
            log: (...args: any[]) => this.logger.debug('沙箱日志:', ...args),
            error: (...args: any[]) => this.logger.error('沙箱错误:', ...args),
            warn: (...args: any[]) => this.logger.warn('沙箱警告:', ...args),
          },
          Math,
          Date,
          JSON,
          Object,
          Array,
          String,
          Number,
          Boolean,
          RegExp,
          Error,
          URL,
          URLSearchParams,
        },
      });

      const wrappedCode = `
        (async function() {
          try {
            ${code}
          } catch (error) {
            return { error: error.message };
          }
        })()
      `;

      const result = await vm.run(wrappedCode);
      const duration = Date.now() - startTime;

      this.logger.log(`沙箱函数执行成功，耗时 ${duration}ms`);

      return {
        success: true,
        data: result || {},
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('沙箱函数执行失败', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
        duration,
      };
    }
  }

  /**
   * 验证代码安全性
   * @param code JavaScript 代码
   * @returns 是否安全
   */
  validateCode(code: string): boolean {
    const forbiddenKeywords = [
      'require',
      'import',
      'eval',
      'Function',
      'process',
      'global',
      'module',
      'exports',
      '__dirname',
      '__filename',
      'child_process',
      'fs',
      'net',
      'http',
      'https',
      'crypto',
    ];

    const lowerCode = code.toLowerCase();
    
    for (const keyword of forbiddenKeywords) {
      if (lowerCode.includes(keyword.toLowerCase())) {
        this.logger.warn(`代码包含禁止的关键字: ${keyword}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 代码静态分析
   * @param code JavaScript 代码
   * @returns 分析结果
   */
  analyzeCode(code: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      new Function(code);
    } catch (error) {
      errors.push(`语法错误: ${error.message}`);
    }

    if (code.includes('while(true)') || code.includes('while (true)')) {
      warnings.push('代码包含无限循环，可能导致超时');
    }

    if (code.includes('delete') && code.includes('window')) {
      errors.push('代码尝试删除全局对象');
    }

    const largeArrayPattern = /new Array\(\d{6,}\)/;
    if (largeArrayPattern.test(code)) {
      warnings.push('代码可能创建超大数组，占用大量内存');
    }

    if (!code.includes('return')) {
      suggestions.push('建议添加 return 语句返回结果');
    }

    if (code.includes('console.log')) {
      suggestions.push('建议移除 console.log 语句');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }
}
