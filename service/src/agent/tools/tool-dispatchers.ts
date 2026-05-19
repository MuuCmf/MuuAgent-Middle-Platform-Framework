import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from './tool-registry';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { McpServerRegistry } from '../../mcp-server/mcp-server-registry';
import { KbSearchTool } from './kb-search.tool';
import { BuiltinExecutor } from '../../skill/executors/builtin.executor';
import { SkillKbService } from '../../skill/skill-kb.service';
import { WORKSPACE_TOOL_NAMES } from '../../workspace/workspace-tool.definitions';
import { ToolExecutionContext } from './abstract/tool.interface';
import { AgentSkills } from '../types/agent-skills';

export const TOOL_DISPATCHERS = 'TOOL_DISPATCHERS';

export interface IToolDispatcher {
  canHandle(name: string): boolean;
  execute(name: string, args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown>;
}

@Injectable()
export class RegisteredToolDispatcher implements IToolDispatcher {
  constructor(private readonly toolRegistry: ToolRegistry) {}

  canHandle(name: string): boolean {
    return this.toolRegistry.has(name);
  }

  async execute(name: string, args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown> {
    const tool = this.toolRegistry.get(name)!;
    return tool.execute(args, context);
  }
}

@Injectable()
export class McpToolDispatcher implements IToolDispatcher {
  private readonly logger = new Logger(McpToolDispatcher.name);

  constructor(
    private readonly mcpServerService: McpServerService,
    private readonly mcpServerRegistry: McpServerRegistry,
  ) {}

  canHandle(name: string): boolean {
    return name.startsWith('mcp__');
  }

  async execute(name: string, args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    const parts = name.split('__');
    if (parts.length < 3) {
      throw new Error(`Invalid MCP tool name format: ${name}. Expected: mcp__serverName__toolName`);
    }

    const serverName = parts[1];
    const toolName = parts.slice(2).join('__');

    const serverConfig = await this.mcpServerRegistry.getServer(serverName);
    if (!serverConfig) {
      throw new Error(`MCP server not found in registry: ${serverName}`);
    }

    return await this.mcpServerService.callToolByName(serverName, toolName, args);
  }
}

@Injectable()
export class KbSearchDispatcher implements IToolDispatcher {
  constructor(
    private readonly kbSearchTool: KbSearchTool,
    private readonly skillKbService: SkillKbService,
  ) {}

  canHandle(name: string): boolean {
    return name === 'kb_search';
  }

  async execute(name: string, args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown> {
    const isolationCtx = context.isolationContext || {
      appCode: context.agent.appCode || null,
      isSuperAdmin: false,
    };
    const agentSkills = AgentSkills.fromJson(context.agent.skills);
    const kbCodes = await this.skillKbService.resolveKbCodes(agentSkills, isolationCtx);

    return await this.kbSearchTool.execute(context.agent.id, kbCodes, {
      query: args.query as string,
      kb_codes: args.kb_codes as string[] | undefined,
      top_k: args.top_k as number | undefined,
      similarity_threshold: args.similarity_threshold as number | undefined,
    });
  }
}

@Injectable()
export class WorkspaceToolDispatcher implements IToolDispatcher {
  canHandle(name: string): boolean {
    return WORKSPACE_TOOL_NAMES.has(name);
  }

  async execute(name: string, _args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    throw new Error(`工作目录工具 "${name}" 需要在客户端执行，不应在服务端直接调用`);
  }
}

@Injectable()
export class BuiltinFunctionDispatcher implements IToolDispatcher {
  constructor(private readonly builtinExecutor: BuiltinExecutor) {}

  canHandle(name: string): boolean {
    return this.builtinExecutor.hasFunction(name);
  }

  async execute(name: string, args: Record<string, unknown>, _context: ToolExecutionContext): Promise<unknown> {
    const result = await this.builtinExecutor.execute(name, args);
    if (!result.success) {
      throw new Error(result.error || `内置工具 ${name} 执行失败`);
    }
    return result.data;
  }
}
