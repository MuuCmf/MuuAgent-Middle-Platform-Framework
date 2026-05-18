import { Injectable, Logger } from '@nestjs/common';
import { IAgentTool, ToolDefinition } from './abstract/tool.interface';

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
}