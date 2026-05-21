import { Injectable, Logger } from '@nestjs/common';
import { IAgentTool, ToolDefinition } from './abstract/tool.interface';
import { BuiltinToolDto } from './dto/builtin-tool.dto';
import { AGENT_TOOL } from './constants/tool.constants';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private tools = new Map<string, IAgentTool>();

  register(tool: IAgentTool): void {
    this.tools.set(tool.name, tool);
    this.logger.debug(`工具已注册: ${tool.name}`);
  }

  get(name: string): IAgentTool | undefined {
    return this.tools.get(name);
  }

  getAll(): IAgentTool[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  clear(): void {
    this.tools.clear();
    this.logger.log('工具注册中心已清空');
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取内置工具列表（用于前端展示）
   * @returns {BuiltinToolDto[]} 内置工具列表
   */
  getBuiltinTools(): BuiltinToolDto[] {
    this.logger.debug('开始获取内置工具列表');
    this.logger.debug(`当前注册的工具总数: ${this.tools.size}`);
    this.logger.debug(`已注册工具名称: ${Array.from(this.tools.keys()).join(', ')}`);
    
    const builtinTools = Array.from(this.tools.values()).filter(tool => {
      const metadata = Reflect.getMetadata(AGENT_TOOL, tool.constructor);
      this.logger.debug(`工具 ${tool.name} 的元数据: ${JSON.stringify(metadata)}`);
      return metadata?.category === 'builtin';
    });

    this.logger.debug(`过滤出的内置工具数量: ${builtinTools.length}`);
    return builtinTools.map(tool => this.transformToDto(tool));
  }

  /**
   * 转换工具为DTO
   * @param tool 工具实例
   * @returns {BuiltinToolDto} 工具DTO
   */
  private transformToDto(tool: IAgentTool): BuiltinToolDto {
    const metadata = Reflect.getMetadata(AGENT_TOOL, tool.constructor);
    const definition = tool.definition;

    return {
      name: definition.name,
      displayName: this.getDisplayName(definition.name),
      description: definition.description,
      category: this.getToolCategory(definition.name),
      sensitive: this.isSensitiveTool(definition.name),
      icon: this.getToolIcon(definition.name),
      parameters: definition.parameters,
      examples: this.getToolExamples(definition.name),
      enabled: metadata?.enabled !== false,
    };
  }

  /**
   * 获取工具显示名称
   * @param name 工具名称
   * @returns {string} 显示名称
   */
  private getDisplayName(name: string): string {
    const displayNames: Record<string, string> = {
      http_request: 'HTTP请求',
      kb_search: '知识库搜索',
      db_query: '数据库查询',
      run_code: '代码执行',
    };
    return displayNames[name] || name;
  }

  /**
   * 获取工具分类
   * @param name 工具名称
   * @returns {string} 工具分类
   */
  private getToolCategory(name: string): string {
    const categories: Record<string, string> = {
      http_request: '网络',
      kb_search: '检索',
      db_query: '数据',
      run_code: '计算',
    };
    return categories[name] || '通用';
  }

  /**
   * 判断是否为敏感工具
   * @param name 工具名称
   * @returns {boolean} 是否敏感
   */
  private isSensitiveTool(name: string): boolean {
    const sensitiveTools = ['db_query', 'run_code'];
    return sensitiveTools.includes(name);
  }

  /**
   * 获取工具图标
   * @param name 工具名称
   * @returns {string} 图标名称
   */
  private getToolIcon(name: string): string {
    const icons: Record<string, string> = {
      http_request: 'Connection',
      kb_search: 'Search',
      db_query: 'Coin',
      run_code: 'Cpu',
    };
    return icons[name] || 'Tools';
  }

  /**
   * 获取工具使用示例
   * @param name 工具名称
   * @returns {string[]} 示例列表
   */
  private getToolExamples(name: string): string[] {
    const examples: Record<string, string[]> = {
      http_request: ['GET请求获取天气数据', 'POST请求调用外部API'],
      kb_search: ['搜索产品文档', '查询FAQ知识库'],
      db_query: ['查询用户数据', '统计订单信息'],
      run_code: ['执行Python脚本', '运行JavaScript代码'],
    };
    return examples[name] || [];
  }
}