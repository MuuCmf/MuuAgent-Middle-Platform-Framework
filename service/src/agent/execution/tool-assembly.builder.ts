import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from '../tools/tool-registry';
import { McpServerService } from '../../mcp-server/mcp-server.service';
import { McpServerRegistry } from '../../mcp-server/mcp-server-registry';
import { KbSearchTool } from '../tools/builtin/kb-search.tool';
import { ToolDefinition } from '../tools/abstract/tool.interface';
import { ClientToolRegistry } from '../../client-tool';
import { SkillResolutionResult } from './skill-resolution.builder';
import { AGENT_TOOL } from '../tools/constants/tool.constants';

@Injectable()
export class ToolAssemblyBuilder {
  private readonly logger = new Logger(ToolAssemblyBuilder.name);

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly mcpServerService: McpServerService,
    private readonly mcpServerRegistry: McpServerRegistry,
    private readonly kbSearchTool: KbSearchTool,
    private readonly clientToolRegistry: ClientToolRegistry,
  ) {}

  async buildTools(
    resolution: SkillResolutionResult,
    resolvedKbCodes: string[],
    agent: { id: any; allowedBuiltinTools?: string; appCode?: string },
    enableKbTool: boolean = true,
    kbToolConfig?: {
      defaultTopN: number;
      defaultSimilarityThresh: number;
      allowSpecifyKb: boolean;
    },
    uid?: string,
  ): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    this.logger.debug(`Building MCP tools for servers: ${JSON.stringify(resolution.resolvedMcpServers)}`);
    for (const serverName of resolution.resolvedMcpServers) {
      await this.addMcpTools(tools, serverName);
    }
    this.logger.debug(`Built ${tools.filter(t => t.type === 'mcp').length} MCP tools`);

    if (enableKbTool && resolvedKbCodes.length > 0) {
      const kbDef = this.kbSearchTool.definition;
      tools.push({
        ...kbDef,
        description: `${kbDef.description} 可用知识库代码: ${resolvedKbCodes.join(', ')}`,
      });
    }

    // 注册工具（use_skill, run_script, run_code 等）
    const { availableSkillNames, boundSkills } = resolution;
    const hasScriptedSkills = boundSkills.some(s => s.metadata.hasScripts);

    // 解析允许使用的内置工具列表
    const allowedBuiltinTools = this.parseAllowedBuiltinTools(agent.allowedBuiltinTools);

    const registeredTools = this.toolRegistry.getAll();
    for (const tool of registeredTools) {
      const def = tool.definition;
      const metadata = Reflect.getMetadata(AGENT_TOOL, tool.constructor);
      const category = metadata?.category || 'builtin';

      if (def.name === 'use_skill') {
        tools.push({
          ...def,
          description: `按需加载指定技能的完整指令。可用技能: ${availableSkillNames}。当需要技能的详细操作步骤、API参数格式或执行注意事项时调用此工具。`,
          parameters: {
            ...def.parameters,
            properties: {
              skill_name: {
                type: 'string',
                description: `要加载的技能名称。可用: ${availableSkillNames}`,
              },
            },
          },
        });
      } else if (def.name === 'run_script') {
        if (hasScriptedSkills) {
          tools.push({
            ...def,
            parameters: {
              ...def.parameters,
              properties: {
                ...def.parameters.properties,
                skill_name: {
                  type: 'string',
                  description: `技能名称。可用: ${availableSkillNames}`,
                },
              },
            },
          });
        }
      } else if (category === 'builtin') {
        // null 表示未配置，允许所有内置工具
        // 空数组 [] 表示明确禁止所有内置工具
        // 有值则只允许列表中的工具
        const isAllowed = allowedBuiltinTools === null || allowedBuiltinTools.includes(def.name);
        if (isAllowed) {
          const existing = tools.find(t => t.name === def.name);
          if (!existing) {
            tools.push(def);
          }
        }
      } else {
        const existing = tools.find(t => t.name === def.name);
        if (!existing) {
          tools.push(def);
        }
      }
    }

    // 客户端工具（通过技能解析结果决定是否启用）
    if (resolution.resolvedWorkspace) {
      const clientTools = this.clientToolRegistry.getToolsForAgent({
        ...agent,
        _workspaceEnabled: true,
      });
      tools.push(...clientTools);
    }

    // 桌面自动化工具（通过技能解析结果决定是否启用）
    if (resolution.resolvedDesktopAutomation) {
      const desktopTools = this.clientToolRegistry.getToolsForAgent({
        ...agent,
        _desktopEnabled: true,
      });
      for (const tool of desktopTools) {
        if (!tools.find(t => t.name === tool.name)) {
          tools.push(tool);
        }
      }
    }

    // 动态客户端工具（用户自扩展，按 appCode+uid 应用级隔离）
    const dynamicTools = this.clientToolRegistry.getToolsForAgent({
      ...agent,
      _uid: uid,
    });
    for (const tool of dynamicTools) {
      if (!tools.find(t => t.name === tool.name)) {
        tools.push(tool);
      }
    }

    return tools;
  }

  private async addMcpTools(tools: ToolDefinition[], serverName: string): Promise<void> {
    const serverConfig = await this.mcpServerRegistry.get(serverName);
    if (!serverConfig) {
      this.logger.warn(`MCP Server ${serverName} 未在注册表中找到`);
      return;
    }

    try {
      const toolsResult = await this.mcpServerService.discoverTools({
        transport: serverConfig.transport,
        url: serverConfig.url,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        apiKey: serverConfig.apiKey,
        timeout: serverConfig.timeout || 30000,
      });

      if (Array.isArray(toolsResult)) {
        tools.push(...toolsResult.map(t => ({
          name: `mcp__${serverName}__${t.name}`,
          description: t.description || '',
          parameters: t.inputSchema || { type: 'object', properties: {} },
          type: 'mcp' as const,
        })));
      }
    } catch (e) {
      this.logger.warn(`从 MCP Server ${serverName} 发现工具失败: ${e}`);
    }
  }

  /**
   * 解析允许使用的内置工具列表
   * @param config JSON字符串配置
   * @returns {string[] | null} 工具名称列表，null表示未配置（允许所有），空数组表示禁止所有
   */
  private parseAllowedBuiltinTools(config?: string): string[] | null {
    if (!config) {
      return null;
    }

    try {
      const tools = JSON.parse(config);
      return Array.isArray(tools) ? tools : null;
    } catch (e) {
      this.logger.warn(`解析allowedBuiltinTools失败: ${e}`);
      return null;
    }
  }
}
