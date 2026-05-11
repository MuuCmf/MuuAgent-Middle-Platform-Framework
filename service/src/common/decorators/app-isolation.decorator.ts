import { SetMetadata } from '@nestjs/common';

/** 应用隔离元数据键 */
export const APP_ISOLATION_KEY = 'app_isolation';

/** 应用隔离配置 */
export interface AppIsolationConfig {
  /** 是否启用应用隔离，默认true */
  enabled?: boolean;

  /** 是否包含公开资源，默认true */
  includePublic?: boolean;

  /** 资源类型，用于日志记录 */
  resourceType?: string;
}

/**
 * 应用隔离装饰器
 * 
 * 用于标记需要进行应用隔离的控制器或方法
 * 
 * @example
 * ```typescript
 * @AppIsolation({ resourceType: 'agent' })
 * export class AgentController { ... }
 * ```
 * 
 * @param config 隔离配置
 * @returns {MethodDecorator & ClassDecorator} 装饰器
 */
export function AppIsolation(config: AppIsolationConfig = {}): MethodDecorator & ClassDecorator {
  const finalConfig: AppIsolationConfig = {
    enabled: config.enabled !== false,
    includePublic: config.includePublic !== false,
    resourceType: config.resourceType || 'unknown',
  };

  return SetMetadata(APP_ISOLATION_KEY, finalConfig);
}

/**
 * 禁用应用隔离装饰器
 * 
 * 用于标记不需要应用隔离的控制器或方法
 * 
 * @example
 * ```typescript
 * @SkipAppIsolation()
 * export class PublicController { ... }
 * ```
 * 
 * @returns {MethodDecorator & ClassDecorator} 装饰器
 */
export function SkipAppIsolation(): MethodDecorator & ClassDecorator {
  return SetMetadata(APP_ISOLATION_KEY, { enabled: false });
}
