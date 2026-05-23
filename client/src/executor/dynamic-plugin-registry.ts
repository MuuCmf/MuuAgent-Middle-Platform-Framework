/**
 * 动态插件定义
 */
export interface DynamicPluginDefinition {
  /** 工具名称 */
  name: string;
  /** 显示名称 */
  displayName?: string;
  /** 工具描述 */
  description: string;
  /** 参数 JSON Schema */
  parameters: Record<string, unknown>;
  /** 执行模板类型 */
  executorType: 'http_request' | 'script' | 'command';
  /** 执行模板配置 */
  executorConfig: Record<string, unknown>;
  /** 确认模式 */
  confirmMode: 'auto' | 'confirm' | 'deny';
  /** 确认消息 */
  confirmMessage?: string;
  /** 超时时间 */
  timeout: number;
}

/**
 * 执行模板处理器接口
 * 每种执行模板类型实现此接口
 */
export interface IExecutorTemplate {
  /**
   * 执行模板
   * @param config 模板配置
   * @param args 工具参数
   * @returns {Promise<unknown>} 执行结果
   */
  execute(config: Record<string, unknown>, args: Record<string, unknown>): Promise<unknown>;
}

/**
 * HTTP 请求执行模板
 * 配置: { url, method, headers, body, timeout }
 */
class HttpRequestTemplate implements IExecutorTemplate {
  /**
   * 执行 HTTP 请求
   * @param config 模板配置
   * @param args 工具参数
   * @returns {Promise<unknown>} 响应数据
   */
  async execute(config: Record<string, unknown>, args: Record<string, unknown>): Promise<unknown> {
    const url = this.interpolate(String(config.url || ''), args)
    const method = String(config.method || 'GET').toUpperCase()
    const headers = (config.headers || {}) as Record<string, string>
    const timeout = Number(config.timeout || 30000)

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }

    if (['POST', 'PUT', 'PATCH'].includes(method) && config.body) {
      const bodyTemplate = typeof config.body === 'string' ? config.body : JSON.stringify(config.body)
      fetchOptions.body = this.interpolate(bodyTemplate, args)
    } else if (['POST', 'PUT', 'PATCH'].includes(method) && Object.keys(args).length > 0) {
      fetchOptions.body = JSON.stringify(args)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    fetchOptions.signal = controller.signal

    try {
      const response = await fetch(url, fetchOptions)
      clearTimeout(timer)

      const contentType = response.headers.get('content-type') || ''
      let data: unknown

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`)
      }

      return data
    } catch (e: any) {
      clearTimeout(timer)
      if (e.name === 'AbortError') {
        throw new Error(`HTTP 请求超时 (${timeout}ms)`)
      }
      throw e
    }
  }

  /**
   * 插值模板字符串
   * 支持 {args.xxx} 占位符
   * @param template 模板字符串
   * @param args 参数
   * @returns {string} 插值后的字符串
   */
  private interpolate(template: string, args: Record<string, unknown>): string {
    return template.replace(/\{args\.(\w+)\}/g, (_, key) => {
      const value = args[key]
      return value !== undefined ? String(value) : `{args.${key}}`
    })
  }
}

/**
 * 脚本执行模板
 * 配置: { script, language }
 * 在浏览器环境中通过 Function 构造器执行 JavaScript
 */
class ScriptTemplate implements IExecutorTemplate {
  /**
   * 执行脚本
   * @param config 模板配置
   * @param args 工具参数
   * @returns {Promise<unknown>} 脚本返回值
   */
  async execute(config: Record<string, unknown>, args: Record<string, unknown>): Promise<unknown> {
    const script = String(config.script || '')
    if (!script) {
      throw new Error('脚本内容为空')
    }

    try {
      const fn = new Function('args', `return (async () => { ${script} })()`)
      return await fn(args)
    } catch (e: any) {
      throw new Error(`脚本执行失败: ${e.message}`)
    }
  }
}

/**
 * 命令执行模板
 * 配置: { command, args }
 * 需要 Electron 环境，通过 IPC 执行系统命令
 */
class CommandTemplate implements IExecutorTemplate {
  /**
   * 执行系统命令
   * @param config 模板配置
   * @param args 工具参数
   * @returns {Promise<unknown>} 命令输出
   */
  async execute(config: Record<string, unknown>, args: Record<string, unknown>): Promise<unknown> {
    const electronAPI = (window as any).electronAPI
    if (!electronAPI) {
      throw new Error('当前不在 Electron 桌面环境中，无法执行系统命令')
    }

    const command = String(config.command || '')
    const commandArgs = (config.args || []) as string[]

    if (!command) {
      throw new Error('命令为空')
    }

    const interpolatedCommand = command.replace(/\{args\.(\w+)\}/g, (_, key) => {
      const value = args[key]
      return value !== undefined ? String(value) : `{args.${key}}`
    })

    const interpolatedArgs = commandArgs.map(arg =>
      arg.replace(/\{args\.(\w+)\}/g, (_, key) => {
        const value = args[key]
        return value !== undefined ? String(value) : `{args.${key}}`
      })
    )

    return electronAPI.executeCommand(interpolatedCommand, interpolatedArgs)
  }
}

/** 执行模板注册表 */
const executorTemplates: Record<string, IExecutorTemplate> = {
  http_request: new HttpRequestTemplate(),
  script: new ScriptTemplate(),
  command: new CommandTemplate(),
}

/**
 * 动态插件注册表
 *
 * 管理用户自扩展的客户端工具插件。
 * 插件来源：
 * 1. 从服务端同步（API 获取工具定义 + 执行配置）
 * 2. 本地注册（代码调用 register 方法）
 */
class DynamicPluginRegistry {
  /** 已注册的插件映射 */
  private plugins = new Map<string, DynamicPluginDefinition>()

  /**
   * 注册插件
   * @param plugin 插件定义
   */
  register(plugin: DynamicPluginDefinition): void {
    this.plugins.set(plugin.name, plugin)
    console.log(`[DynamicPluginRegistry] 插件已注册: ${plugin.name} (${plugin.executorType})`)
  }

  /**
   * 批量注册插件（先清空再注册）
   * @param plugins 插件定义列表
   */
  sync(plugins: DynamicPluginDefinition[]): void {
    this.plugins.clear()
    for (const plugin of plugins) {
      this.plugins.set(plugin.name, plugin)
    }
    console.log(`[DynamicPluginRegistry] 已同步 ${plugins.length} 个插件`)
  }

  /**
   * 注销插件
   * @param name 插件名称
   */
  unregister(name: string): void {
    this.plugins.delete(name)
  }

  /**
   * 获取插件定义
   * @param name 插件名称
   * @returns {DynamicPluginDefinition | undefined} 插件定义
   */
  get(name: string): DynamicPluginDefinition | undefined {
    return this.plugins.get(name)
  }

  /**
   * 获取所有已注册的插件
   * @returns {DynamicPluginDefinition[]} 插件列表
   */
  getAll(): DynamicPluginDefinition[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 执行插件
   * @param name 插件名称
   * @param args 工具参数
   * @returns {Promise<unknown>} 执行结果
   */
  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const plugin = this.plugins.get(name)
    if (!plugin) {
      throw new Error(`未注册的动态工具: ${name}`)
    }

    const template = executorTemplates[plugin.executorType]
    if (!template) {
      throw new Error(`未知的执行模板类型: ${plugin.executorType}`)
    }

    return template.execute(plugin.executorConfig, args)
  }
}

/** 全局动态插件注册表实例 */
export const dynamicPluginRegistry = new DynamicPluginRegistry()
