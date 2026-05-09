import { Injectable, Logger } from '@nestjs/common';
import { FunctionResult, ParameterDefinition } from '../interfaces/plugin.interface';
import { PluginLoader } from '../plugin-loader';

/**
 * 插件函数执行器
 */
@Injectable()
export class PluginExecutor {
  private readonly logger = new Logger(PluginExecutor.name);

  constructor(private readonly pluginLoader: PluginLoader) {}

  /**
   * 执行插件函数
   * @param pluginName 插件名称
   * @param functionName 函数名称
   * @param params 参数
   * @returns 执行结果
   */
  async execute(
    pluginName: string,
    functionName: string,
    params: Record<string, unknown>,
  ): Promise<FunctionResult> {
    const startTime = Date.now();

    try {
      const plugin = this.pluginLoader.getPlugin(pluginName);
      if (!plugin) {
        return {
          success: false,
          error: `未找到插件: ${pluginName}`,
        };
      }

      const func = plugin.functions[functionName];
      if (!func) {
        return {
          success: false,
          error: `插件 ${pluginName} 中未找到函数: ${functionName}`,
        };
      }

      this.validateParameters(func.parameters, params);

      const data = await func.execute(params);
      const duration = Date.now() - startTime;

      this.logger.log(
        `插件函数 ${pluginName}.${functionName} 执行成功，耗时 ${duration}ms`,
      );

      return {
        success: true,
        data,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `插件函数 ${pluginName}.${functionName} 执行失败`,
        error,
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
        duration,
      };
    }
  }

  /**
   * 验证参数
   */
  private validateParameters(
    definitions: ParameterDefinition[],
    params: Record<string, unknown>,
  ): void {
    for (const def of definitions) {
      if (def.required && params[def.name] === undefined) {
        throw new Error(`缺少必填参数: ${def.name}`);
      }

      if (params[def.name] !== undefined) {
        const value = params[def.name];
        const type = typeof value;

        if (def.type === 'array' && !Array.isArray(value)) {
          throw new Error(`参数 ${def.name} 必须是数组类型`);
        }

        if (def.type !== 'array' && type !== def.type) {
          throw new Error(`参数 ${def.name} 必须是 ${def.type} 类型`);
        }

        if (def.validation) {
          if (def.validation.min !== undefined && (value as number) < def.validation.min) {
            throw new Error(`参数 ${def.name} 不能小于 ${def.validation.min}`);
          }
          if (def.validation.max !== undefined && (value as number) > def.validation.max) {
            throw new Error(`参数 ${def.name} 不能大于 ${def.validation.max}`);
          }
          if (def.validation.pattern && !new RegExp(def.validation.pattern).test(String(value))) {
            throw new Error(`参数 ${def.name} 格式不正确`);
          }
          if (def.validation.enum && !def.validation.enum.includes(String(value))) {
            throw new Error(`参数 ${def.name} 必须是以下值之一: ${def.validation.enum.join(', ')}`);
          }
        }
      }
    }
  }
}
