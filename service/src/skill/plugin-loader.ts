import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SkillPlugin } from './interfaces/plugin.interface';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 插件加载器
 */
@Injectable()
export class PluginLoader implements OnModuleInit {
  private readonly logger = new Logger(PluginLoader.name);
  private plugins: Map<string, SkillPlugin> = new Map();

  /**
   * 模块初始化时加载所有插件
   */
  async onModuleInit() {
    await this.loadPlugins();
  }

  /**
   * 加载所有插件
   */
  async loadPlugins(): Promise<void> {
    const pluginDir = path.join(process.cwd(), 'skills', 'plugins');

    if (!fs.existsSync(pluginDir)) {
      this.logger.warn('插件目录不存在，跳过加载');
      return;
    }

    const files = fs.readdirSync(pluginDir).filter(
      (f) => f.endsWith('.ts') || f.endsWith('.js'),
    );

    this.logger.log(`发现 ${files.length} 个插件文件`);

    for (const file of files) {
      try {
        await this.loadPlugin(path.join(pluginDir, file));
      } catch (error) {
        this.logger.error(`加载插件失败: ${file}`, error);
      }
    }

    this.logger.log(`成功加载 ${this.plugins.size} 个插件`);
  }

  /**
   * 加载单个插件
   */
  private async loadPlugin(pluginPath: string): Promise<void> {
    const module = await import(pluginPath);
    const plugin: SkillPlugin = module.default || module[Object.keys(module)[0]];

    if (!plugin || !plugin.name) {
      throw new Error('插件格式不正确');
    }

    this.validatePlugin(plugin);

    this.plugins.set(plugin.name, plugin);
    this.logger.log(
      `加载插件: ${plugin.name} v${plugin.version} (${Object.keys(plugin.functions).length} 个函数)`,
    );
  }

  /**
   * 验证插件结构
   */
  private validatePlugin(plugin: SkillPlugin): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('插件名称必须是非空字符串');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error('插件版本必须是非空字符串');
    }

    if (!plugin.functions || typeof plugin.functions !== 'object') {
      throw new Error('插件必须包含 functions 对象');
    }

    for (const [funcName, func] of Object.entries(plugin.functions)) {
      if (!func.name || !func.description || !func.execute) {
        throw new Error(`函数 ${funcName} 结构不完整`);
      }
    }
  }

  /**
   * 获取插件
   */
  getPlugin(name: string): SkillPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): SkillPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取所有函数
   */
  getAllFunctions(): Record<string, (params: Record<string, unknown>) => Promise<Record<string, unknown>>> {
    const functions: Record<string, (params: Record<string, unknown>) => Promise<Record<string, unknown>>> = {};

    this.plugins.forEach((plugin) => {
      Object.entries(plugin.functions).forEach(([name, func]) => {
        functions[`${plugin.name}.${name}`] = func.execute;
      });
    });

    return functions;
  }

  /**
   * 重新加载插件
   */
  async reloadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }

    const pluginPath = path.join(process.cwd(), 'skills', 'plugins', `${name}.ts`);
    if (require.cache[require.resolve(pluginPath)]) {
      delete require.cache[require.resolve(pluginPath)];
    }

    await this.loadPlugin(pluginPath);
    return true;
  }
}
